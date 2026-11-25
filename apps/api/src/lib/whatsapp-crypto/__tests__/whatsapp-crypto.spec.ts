import { Buffer } from 'node:buffer';
import { createCipheriv, createHmac, randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  WHATSAPP_MEDIA_TYPES,
  WhatsAppCryptoError,
  decodePollVoteMessage,
  decryptMediaBuffer,
  decryptPollVote,
  deriveMediaKeys,
  resolveDownloadableMedia,
  tryToBuffer,
  type WhatsAppMediaType,
} from '..';
import vectors from './fixtures/whatsapp-crypto-vectors.json';
import {
  encodePollVoteMessage,
  encryptMediaForTest,
  encryptPollVoteForTest,
  protoField,
  sha256,
} from './test-utils';

const fromHex = (value: string) => Buffer.from(value, 'hex');
const hex = (value: Uint8Array) => Buffer.from(value).toString('hex');

const expectCryptoError = (fn: () => unknown, code: WhatsAppCryptoError['code']): WhatsAppCryptoError => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(WhatsAppCryptoError);
    expect((error as WhatsAppCryptoError).code).toBe(code);
    return error as WhatsAppCryptoError;
  }
  throw new Error(`expected WhatsAppCryptoError ${code}`);
};

const flipByte = (buffer: Buffer, position: number): Buffer => {
  const copy = Buffer.from(buffer);
  copy[position] = (copy[position] ?? 0) ^ 0x01;
  return copy;
};

describe('fixed vectors (verified against Baileys 6.7.8 before its removal)', () => {
  it('covers every media type', () => {
    const keyTypes = new Set(vectors.mediaKeys.map((vector) => vector.mediaType));
    const mediaTypes = new Set(vectors.media.map((vector) => vector.mediaType));
    expect([...keyTypes].sort()).toEqual([...WHATSAPP_MEDIA_TYPES].sort());
    expect([...mediaTypes].sort()).toEqual([...WHATSAPP_MEDIA_TYPES].sort());
    expect(vectors.polls.length).toBeGreaterThanOrEqual(40);
  });

  it.each(vectors.mediaKeys)('derives media keys for $mediaType', (vector) => {
    const keys = deriveMediaKeys(fromHex(vector.mediaKey), vector.mediaType as WhatsAppMediaType);
    expect(hex(keys.iv)).toBe(vector.iv);
    expect(hex(keys.cipherKey)).toBe(vector.cipherKey);
    expect(hex(keys.macKey)).toBe(vector.macKey);
  });

  it.each(vectors.media)('decrypts $mediaType media vector', (vector) => {
    const keys = deriveMediaKeys(fromHex(vector.mediaKey), vector.mediaType as WhatsAppMediaType);
    const plaintext = decryptMediaBuffer(fromHex(vector.encrypted), keys, {
      fileSha256: fromHex(vector.fileSha256),
      fileEncSha256: fromHex(vector.fileEncSha256),
    });
    expect(hex(plaintext)).toBe(vector.plaintext);
  });

  it.each(vectors.polls.map((vector, index) => ({ ...vector, index })))(
    'decrypts poll vote vector #$index',
    (vector) => {
      const vote = decryptPollVote(
        { encPayload: fromHex(vector.encPayload), encIv: fromHex(vector.encIv) },
        {
          pollMsgId: vector.pollMsgId,
          pollCreatorJid: vector.pollCreatorJid,
          voterJid: vector.voterJid,
          pollEncKey: fromHex(vector.pollEncKey),
        }
      );
      expect(vote.selectedOptions.map(hex)).toEqual(vector.selectedOptions);
      // selectedOptions are SHA-256 hashes of the option names
      expect(vector.optionNames.map((name) => hex(sha256(Buffer.from(name))))).toEqual(vector.selectedOptions);
    }
  );
});

describe('deriveMediaKeys', () => {
  it('accepts base64, JSON-serialized Buffer and byte arrays', () => {
    const mediaKey = randomBytes(32);
    const expected = hex(deriveMediaKeys(mediaKey, 'image').cipherKey);
    for (const input of [
      mediaKey.toString('base64'),
      `data:;base64,${mediaKey.toString('base64')}`,
      mediaKey.toString('base64url'),
      JSON.parse(JSON.stringify(mediaKey)),
      JSON.parse(JSON.stringify(new Uint8Array(mediaKey))),
      Array.from(mediaKey),
      new Uint8Array(mediaKey),
    ]) {
      expect(hex(deriveMediaKeys(input, 'image').cipherKey)).toBe(expected);
    }
  });

  it('rejects keys that are not 32 bytes and unknown media types', () => {
    expectCryptoError(() => deriveMediaKeys(randomBytes(31), 'image'), 'INVALID_INPUT');
    expectCryptoError(() => deriveMediaKeys('not base64!', 'image'), 'INVALID_INPUT');
    expectCryptoError(() => deriveMediaKeys(undefined, 'image'), 'INVALID_INPUT');
    expectCryptoError(() => deriveMediaKeys(randomBytes(32), 'hologram' as WhatsAppMediaType), 'INVALID_INPUT');
  });
});

describe('decryptMediaBuffer', () => {
  const setup = (size = 100, mediaType: WhatsAppMediaType = 'image') => {
    const fixture = encryptMediaForTest(randomBytes(size), mediaType);
    return { ...fixture, keys: deriveMediaKeys(fixture.mediaKey, mediaType) };
  };

  it('round-trips every media type and size boundary', () => {
    for (const mediaType of WHATSAPP_MEDIA_TYPES) {
      for (const size of [0, 1, 15, 16, 17, 4096]) {
        const { plaintext, encrypted, keys } = setup(size, mediaType);
        expect(decryptMediaBuffer(encrypted, keys).equals(plaintext)).toBe(true);
      }
    }
  });

  it('rejects any modified byte (ciphertext or MAC) with INVALID_MAC', () => {
    const { encrypted, keys } = setup(64);
    for (let position = 0; position < encrypted.length; position += 1) {
      expectCryptoError(() => decryptMediaBuffer(flipByte(encrypted, position), keys), 'INVALID_MAC');
    }
  });

  it('verifies the MAC before decrypting (bad MAC + bad padding → INVALID_MAC, not a padding error)', () => {
    const { keys } = setup(32);
    const garbage = Buffer.concat([randomBytes(48), randomBytes(10)]);
    expectCryptoError(() => decryptMediaBuffer(garbage, keys), 'INVALID_MAC');
  });

  it('rejects keys of another media type', () => {
    const { encrypted, mediaKey } = setup(64, 'image');
    expectCryptoError(() => decryptMediaBuffer(encrypted, deriveMediaKeys(mediaKey, 'video')), 'INVALID_MAC');
  });

  it('rejects truncated or malformed blobs with INVALID_INPUT', () => {
    const { encrypted, keys } = setup(64);
    expectCryptoError(() => decryptMediaBuffer(encrypted.subarray(0, encrypted.length - 1), keys), 'INVALID_INPUT');
    expectCryptoError(() => decryptMediaBuffer(encrypted.subarray(0, 25), keys), 'INVALID_INPUT');
    expectCryptoError(() => decryptMediaBuffer(Buffer.alloc(0), keys), 'INVALID_INPUT');
  });

  it('reports DECRYPT_FAILED when the MAC is valid but the PKCS#7 padding is not', () => {
    const { keys } = setup(0);
    const cipher = createCipheriv('aes-256-cbc', keys.cipherKey, keys.iv).setAutoPadding(false);
    const block = Buffer.alloc(32, 0x41);
    block[31] = 0x00; // padding byte 0 is never valid
    const ciphertext = Buffer.concat([cipher.update(block), cipher.final()]);
    const mac = createHmac('sha256', keys.macKey).update(keys.iv).update(ciphertext).digest().subarray(0, 10);
    expectCryptoError(() => decryptMediaBuffer(Buffer.concat([ciphertext, mac]), keys), 'DECRYPT_FAILED');
  });

  it('checks fileEncSha256 and fileSha256 when provided', () => {
    const { encrypted, keys, fileSha256, fileEncSha256, plaintext } = setup(100);
    expect(decryptMediaBuffer(encrypted, keys, { fileSha256, fileEncSha256 }).equals(plaintext)).toBe(true);
    expectCryptoError(
      () => decryptMediaBuffer(encrypted, keys, { fileEncSha256: flipByte(fileEncSha256, 0) }),
      'HASH_MISMATCH'
    );
    expectCryptoError(() => decryptMediaBuffer(encrypted, keys, { fileSha256: flipByte(fileSha256, 31) }), 'HASH_MISMATCH');
    expectCryptoError(() => decryptMediaBuffer(encrypted, keys, { fileSha256: randomBytes(16) }), 'INVALID_INPUT');
  });

  it('never puts key material in error messages or details', () => {
    const { encrypted, keys, mediaKey } = setup(64);
    const error = expectCryptoError(() => decryptMediaBuffer(flipByte(encrypted, 3), keys), 'INVALID_MAC');
    const serialized = `${error.message} ${JSON.stringify(error.details)}`;
    for (const secret of [mediaKey, keys.cipherKey, keys.macKey, keys.iv]) {
      expect(serialized).not.toContain(secret.toString('hex'));
      expect(serialized).not.toContain(secret.toString('base64'));
    }
  });
});

describe('resolveDownloadableMedia', () => {
  it('maps content keys to media types and unwraps wrappers', () => {
    const media = { url: 'https://mmg.whatsapp.net/x', directPath: '/x', mediaKey: 'k' };
    expect(resolveDownloadableMedia({ message: { audioMessage: media } })?.mediaType).toBe('audio');
    expect(resolveDownloadableMedia({ message: { viewOnceMessage: { message: { videoMessage: media } } } })?.mediaType).toBe(
      'video'
    );
    expect(resolveDownloadableMedia({ message: { editedMessage: { message: { stickerMessage: media } } } })?.mediaType).toBe(
      'sticker'
    );
    expect(resolveDownloadableMedia({ message: { conversation: 'hi' } })).toBeNull();
    expect(resolveDownloadableMedia({ message: { imageMessage: { caption: 'no url' } } })).toBeNull();
    expect(resolveDownloadableMedia({ message: { locationMessage: { url: 'x' } } })).toBeNull();
    expect(resolveDownloadableMedia(null)).toBeNull();
  });
});

describe('decryptPollVote', () => {
  const build = (selected: Buffer[] = [sha256(Buffer.from('Sim'))]) => {
    const context = {
      pollMsgId: '3EB0C0FFEE',
      pollCreatorJid: '5511999999999@s.whatsapp.net',
      voterJid: '5511888888888@s.whatsapp.net',
      pollEncKey: randomBytes(32),
    };
    const encIv = randomBytes(12);
    const encPayload = encryptPollVoteForTest({ ...context, encIv, plaintext: encodePollVoteMessage(selected) });
    return { context, encIv, encPayload, selected };
  };

  it('returns Buffers (callers base64-encode them)', () => {
    const { context, encIv, encPayload, selected } = build();
    const vote = decryptPollVote({ encPayload, encIv }, context);
    expect(vote.selectedOptions).toHaveLength(1);
    expect(Buffer.isBuffer(vote.selectedOptions[0])).toBe(true);
    expect(vote.selectedOptions[0]!.equals(selected[0]!)).toBe(true);
  });

  it('fails authentication when any context field differs', () => {
    const { context, encIv, encPayload } = build();
    for (const override of [
      { pollMsgId: '3EB0C0FFEF' },
      { pollCreatorJid: '5511999999998@s.whatsapp.net' },
      { voterJid: '5511888888889@s.whatsapp.net' },
      { pollEncKey: randomBytes(32) },
    ]) {
      expectCryptoError(() => decryptPollVote({ encPayload, encIv }, { ...context, ...override }), 'DECRYPT_FAILED');
    }
    expectCryptoError(() => decryptPollVote({ encPayload, encIv: randomBytes(12) }, context), 'DECRYPT_FAILED');
    expectCryptoError(() => decryptPollVote({ encPayload: flipByte(encPayload, 0), encIv }, context), 'DECRYPT_FAILED');
  });

  it('validates input shapes', () => {
    const { context, encIv, encPayload } = build();
    expectCryptoError(() => decryptPollVote({ encPayload, encIv: randomBytes(16) }, context), 'INVALID_INPUT');
    expectCryptoError(() => decryptPollVote({ encPayload: randomBytes(15), encIv }, context), 'INVALID_INPUT');
    expectCryptoError(() => decryptPollVote({ encPayload, encIv }, { ...context, pollEncKey: randomBytes(16) }), 'INVALID_INPUT');
    expectCryptoError(() => decryptPollVote({ encPayload, encIv }, { ...context, voterJid: '' }), 'INVALID_INPUT');
  });

  it('decodes an empty vote (no option selected)', () => {
    const { context, encIv, encPayload } = build([]);
    expect(decryptPollVote({ encPayload, encIv }, context).selectedOptions).toEqual([]);
  });

  it('rejects an authenticated but malformed protobuf with MALFORMED_PROTOBUF', () => {
    const context = { pollMsgId: 'ID', pollCreatorJid: 'a@s.whatsapp.net', voterJid: 'b@lid', pollEncKey: randomBytes(32) };
    const encIv = randomBytes(12);
    const encPayload = encryptPollVoteForTest({ ...context, encIv, plaintext: Buffer.from([0x0a, 0x20, 0x01]) });
    expectCryptoError(() => decryptPollVote({ encPayload, encIv }, context), 'MALFORMED_PROTOBUF');
  });
});

describe('decodePollVoteMessage (protobuf reader)', () => {
  const option = sha256(Buffer.from('A'));

  it('skips unknown fields of every wire type, including field 1 with a non-bytes wire type', () => {
    const message = Buffer.concat([
      protoField.varint(2, 300),
      protoField.fixed64(3),
      protoField.fixed32(4),
      protoField.bytes(5, Buffer.from('ignored')),
      protoField.group(6, Buffer.concat([protoField.varint(1, 1), protoField.group(2, protoField.fixed32(3))])),
      protoField.varint(1, 42),
      protoField.bytes(1, option),
      protoField.varint(536_870_911, 1), // max field number
    ]);
    expect(decodePollVoteMessage(message).selectedOptions.map(hex)).toEqual([hex(option)]);
  });

  it.each([
    ['truncated length-delimited field', Buffer.from([0x0a, 0x05, 0x01])],
    ['truncated varint', Buffer.from([0x10, 0x80])],
    ['varint longer than 10 bytes', Buffer.from([0x10, ...Array(10).fill(0xff), 0x01])],
    ['10th varint byte above 1', Buffer.from([0x10, ...Array(9).fill(0xff), 0x02])],
    ['invalid wire type 6', Buffer.from([0x0e])],
    ['invalid wire type 7', Buffer.from([0x0f])],
    ['field number 0', Buffer.from([0x02, 0x00])],
    ['truncated fixed64', Buffer.from([0x11, 1, 2, 3])],
    ['truncated fixed32', Buffer.from([0x15, 1])],
    ['unexpected end group', Buffer.from([0x0c])],
    ['unterminated group', Buffer.from([0x0b, 0x08, 0x01])],
    ['mismatched end group', Buffer.from([0x0b, 0x14])],
    ['length beyond 2^32', Buffer.from([0x0a, 0xff, 0xff, 0xff, 0xff, 0x7f])],
  ])('rejects %s', (_name, bytes) => {
    expectCryptoError(() => decodePollVoteMessage(bytes), 'MALFORMED_PROTOBUF');
  });

  it('rejects deeply nested groups without overflowing the stack', () => {
    const depth = 100;
    const open = Buffer.alloc(depth, 0x0b); // field 1, start group
    const close = Buffer.alloc(depth, 0x0c); // field 1, end group
    expectCryptoError(() => decodePollVoteMessage(Buffer.concat([protoField.varint(2, 0), open, close])), 'MALFORMED_PROTOBUF');
  });

  it('never throws anything but MALFORMED_PROTOBUF on random input (fuzz)', () => {
    for (let index = 0; index < 2000; index += 1) {
      const input = randomBytes(index % 64);
      try {
        decodePollVoteMessage(input);
      } catch (error) {
        expect(error).toBeInstanceOf(WhatsAppCryptoError);
        expect((error as WhatsAppCryptoError).code).toBe('MALFORMED_PROTOBUF');
      }
    }
  });
});

describe('tryToBuffer', () => {
  it('normalizes the binary encodings seen in webhook payloads', () => {
    const bytes = Buffer.from([1, 2, 3, 250]);
    expect(tryToBuffer(bytes.toString('base64'))?.equals(bytes)).toBe(true);
    expect(tryToBuffer(bytes.toString('base64url'))?.equals(bytes)).toBe(true);
    expect(tryToBuffer({ type: 'Buffer', data: [1, 2, 3, 250] })?.equals(bytes)).toBe(true);
    expect(tryToBuffer({ 0: 1, 1: 2, 2: 3, 3: 250 })?.equals(bytes)).toBe(true);
    expect(tryToBuffer(new Uint8Array([1, 2, 3, 250]).buffer)?.equals(bytes)).toBe(true);
    expect(tryToBuffer('%%%')).toBeNull();
    expect(tryToBuffer('A')).toBeNull();
    expect(tryToBuffer({ foo: 1 })).toBeNull();
    expect(tryToBuffer([1, 256])).toBeNull();
    expect(tryToBuffer(42)).toBeNull();
  });
});
