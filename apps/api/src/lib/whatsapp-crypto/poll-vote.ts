import { Buffer } from 'node:buffer';
import { createDecipheriv, createHmac } from 'node:crypto';

import { toBuffer } from './bytes';
import { WhatsAppCryptoError } from './errors';
import { ProtobufReader } from './protobuf';

/** Decoded `proto.Message.PollVoteMessage` (`repeated bytes selectedOptions = 1`). */
export interface PollVoteMessage {
  /** SHA-256 of each selected option name, in message order. */
  selectedOptions: Buffer[];
}

export interface EncryptedPollVote {
  /** AES-256-GCM ciphertext with the 16-byte auth tag appended. */
  encPayload: Uint8Array;
  /** 12-byte GCM nonce. */
  encIv: Uint8Array;
}

export interface PollVoteDecryptionContext {
  /** JID of the poll author (participant in groups, remoteJid otherwise). */
  pollCreatorJid: string;
  /** Message id of the poll creation message. */
  pollMsgId: string;
  /** `messageContextInfo.messageSecret` of the poll creation message (32 bytes). */
  pollEncKey: Uint8Array;
  /** JID of the voter. */
  voterJid: string;
}

const POLL_FIELD_SELECTED_OPTIONS = 1;
const WIRE_TYPE_LENGTH_DELIMITED = 2;
const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 16;
const POLL_ENC_KEY_LENGTH = 32;

/**
 * Decodes the `PollVoteMessage` protobuf. Unknown fields (any wire type) are skipped, as is
 * field 1 when it does not use the length-delimited wire type. Malformed input throws
 * `MALFORMED_PROTOBUF`.
 */
export const decodePollVoteMessage = (bytes: Uint8Array): PollVoteMessage => {
  const reader = new ProtobufReader(bytes);
  const selectedOptions: Buffer[] = [];
  while (!reader.done) {
    const { fieldNumber, wireType } = reader.tag();
    if (fieldNumber === POLL_FIELD_SELECTED_OPTIONS && wireType === WIRE_TYPE_LENGTH_DELIMITED) {
      selectedOptions.push(Buffer.from(reader.lengthDelimited()));
    } else {
      reader.skip(wireType, fieldNumber);
    }
  }
  return { selectedOptions };
};

const requireString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new WhatsAppCryptoError('INVALID_INPUT', `${field} must be a non-empty string`, { details: { field } });
  }
  return value;
};

/**
 * Derives the per-voter AES-256-GCM key of a poll vote:
 * key0 = HMAC-SHA256(key = 32 zero bytes, pollEncKey);
 * decKey = HMAC-SHA256(key = key0, pollMsgId ‖ pollCreatorJid ‖ voterJid ‖ "Poll Vote" ‖ 0x01).
 */
export const derivePollVoteKey = (context: PollVoteDecryptionContext): Buffer => {
  const pollMsgId = requireString(context.pollMsgId, 'pollMsgId');
  const pollCreatorJid = requireString(context.pollCreatorJid, 'pollCreatorJid');
  const voterJid = requireString(context.voterJid, 'voterJid');
  const pollEncKey = toBuffer(context.pollEncKey, 'pollEncKey', { length: POLL_ENC_KEY_LENGTH });

  const sign = Buffer.concat([
    Buffer.from(pollMsgId, 'utf8'),
    Buffer.from(pollCreatorJid, 'utf8'),
    Buffer.from(voterJid, 'utf8'),
    Buffer.from('Poll Vote', 'utf8'),
    Buffer.from([1]),
  ]);
  const key0 = createHmac('sha256', Buffer.alloc(32, 0)).update(pollEncKey).digest();
  return createHmac('sha256', key0).update(sign).digest();
};

/**
 * Decrypts a `pollUpdateMessage.vote` (drop-in for Baileys `decryptPollVote`).
 * AES-256-GCM with AAD = `${pollMsgId}\0${voterJid}`; authentication failure throws `DECRYPT_FAILED`.
 */
export const decryptPollVote = (
  { encPayload, encIv }: EncryptedPollVote,
  context: PollVoteDecryptionContext
): PollVoteMessage => {
  const payload = toBuffer(encPayload, 'encPayload', { minLength: GCM_TAG_LENGTH });
  const iv = toBuffer(encIv, 'encIv', { length: GCM_IV_LENGTH });
  const key = derivePollVoteKey(context);
  const aad = Buffer.from(`${context.pollMsgId}\u0000${context.voterJid}`, 'utf8');

  const ciphertext = payload.subarray(0, payload.length - GCM_TAG_LENGTH);
  const tag = payload.subarray(payload.length - GCM_TAG_LENGTH);

  let plaintext: Buffer;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: GCM_TAG_LENGTH });
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (error) {
    throw new WhatsAppCryptoError('DECRYPT_FAILED', 'Poll vote authentication failed', { cause: error });
  }

  return decodePollVoteMessage(plaintext);
};
