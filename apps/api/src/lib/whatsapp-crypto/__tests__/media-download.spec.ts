import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  WhatsAppCryptoError,
  downloadAndDecryptMedia,
  downloadAndDecryptMessageMedia,
  isAllowedWhatsAppMediaUrl,
  resolveMediaDownloadUrl,
  type MediaFetch,
} from '..';
import {
  allowLocalhost,
  encryptMediaForTest,
  serveBuffer,
  startMediaServer,
  type RouteHandler,
} from './test-utils';

const routes = new Map<string, RouteHandler>();
let server: Awaited<ReturnType<typeof startMediaServer>>;

beforeAll(async () => {
  server = await startMediaServer(routes);
});

afterAll(async () => {
  await server.close();
});

const expectRejection = async (promise: Promise<unknown>, code: WhatsAppCryptoError['code']) => {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught
  );
  expect(error).toBeInstanceOf(WhatsAppCryptoError);
  expect((error as WhatsAppCryptoError).code).toBe(code);
  return error as WhatsAppCryptoError;
};

const publish = (path: string, size = 1024, mediaType: 'image' | 'document' = 'image') => {
  const fixture = encryptMediaForTest(randomBytes(size), mediaType);
  routes.set(path, serveBuffer(fixture.encrypted));
  return { ...fixture, url: `${server.origin}${path}` };
};

describe('isAllowedWhatsAppMediaUrl', () => {
  it.each([
    ['https://mmg.whatsapp.net/v/t62.7118-24/1.enc?ccb=11-4', true],
    ['https://media-gru1-1.cdn.whatsapp.net/v/t62/1.enc', true],
    ['https://MMG.WhatsApp.net/x', true],
    ['https://mmg.whatsapp.net:443/x', true],
    ['http://mmg.whatsapp.net/x', false],
    ['https://mmg.whatsapp.net:8443/x', false],
    ['https://user:pass@mmg.whatsapp.net/x', false],
    ['https://whatsapp.net.evil.com/x', false],
    ['https://evilwhatsapp.net/x', false],
    ['https://mmg.whatsapp.net.evil.com/x', false],
    ['https://127.0.0.1/x', false],
    ['https://169.254.169.254/latest/meta-data', false],
    ['file:///etc/passwd', false],
  ])('%s → %s', (url, allowed) => {
    expect(isAllowedWhatsAppMediaUrl(new URL(url))).toBe(allowed);
  });
});

describe('resolveMediaDownloadUrl', () => {
  it('prefers an allowed url and otherwise builds https://mmg.whatsapp.net + directPath', () => {
    expect(resolveMediaDownloadUrl({ url: 'https://mmg.whatsapp.net/a?x=1', directPath: '/b' }).toString()).toBe(
      'https://mmg.whatsapp.net/a?x=1'
    );
    expect(resolveMediaDownloadUrl({ url: 'https://evil.example/a', directPath: '/b?y=2' }).toString()).toBe(
      'https://mmg.whatsapp.net/b?y=2'
    );
    expect(resolveMediaDownloadUrl({ directPath: 'v/t62/c.enc' }).toString()).toBe('https://mmg.whatsapp.net/v/t62/c.enc');
    expect(resolveMediaDownloadUrl({ directPath: 'https://mmg.whatsapp.net/d' }).toString()).toBe(
      'https://mmg.whatsapp.net/d'
    );
  });

  it('never lets the payload choose another host', () => {
    expect(() => resolveMediaDownloadUrl({ url: 'https://evil.example/a' })).toThrow(
      expect.objectContaining({ code: 'HOST_NOT_ALLOWED' })
    );
    expect(() => resolveMediaDownloadUrl({ directPath: 'http://169.254.169.254/latest' })).toThrow(
      expect.objectContaining({ code: 'HOST_NOT_ALLOWED' })
    );
    expect(() => resolveMediaDownloadUrl({ directPath: '//evil.example/a' })).toThrow(
      expect.objectContaining({ code: 'HOST_NOT_ALLOWED' })
    );
    expect(resolveMediaDownloadUrl({ directPath: '@evil.example/a' }).host).toBe('mmg.whatsapp.net');
    expect(() => resolveMediaDownloadUrl({})).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
  });
});

describe('downloadAndDecryptMedia', () => {
  it('downloads and decrypts from the CDN (url or directPath)', async () => {
    const { mediaKey, plaintext, url, fileSha256, fileEncSha256 } = publish('/v/t62/ok.enc', 70_000);
    const fromUrl = await downloadAndDecryptMedia({ mediaKey, url, fileSha256, fileEncSha256 }, 'image', {
      allowUrl: allowLocalhost,
    });
    expect(fromUrl.equals(plaintext)).toBe(true);

    const fromPath = await downloadAndDecryptMedia({ mediaKey: mediaKey.toString('base64'), directPath: '/v/t62/ok.enc' }, 'image', {
      allowUrl: allowLocalhost,
      mediaOrigin: server.origin,
    });
    expect(fromPath.equals(plaintext)).toBe(true);
  });

  it('sends the WhatsApp Web Origin header and caller headers', async () => {
    const fixture = encryptMediaForTest(randomBytes(10), 'image');
    let seen: Record<string, unknown> = {};
    routes.set('/headers.enc', (req, res) => {
      seen = req.headers;
      serveBuffer(fixture.encrypted)(req, res);
    });
    await downloadAndDecryptMedia({ mediaKey: fixture.mediaKey, url: `${server.origin}/headers.enc` }, 'image', {
      allowUrl: allowLocalhost,
      headers: { 'User-Agent': 'LeadEngine test', Origin: 'https://evil.example' },
    });
    expect(seen.origin).toBe('https://web.whatsapp.com');
    expect(seen['user-agent']).toBe('LeadEngine test');
  });

  it('does not touch the network for disallowed hosts (default allow-list)', async () => {
    const fetchSpy = vi.fn<Parameters<MediaFetch>, ReturnType<MediaFetch>>();
    const { mediaKey, url } = publish('/blocked.enc');
    await expectRejection(downloadAndDecryptMedia({ mediaKey, url }, 'image', { fetch: fetchSpy }), 'HOST_NOT_ALLOWED');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('validates the media key before downloading', async () => {
    const fetchSpy = vi.fn<Parameters<MediaFetch>, ReturnType<MediaFetch>>();
    await expectRejection(
      downloadAndDecryptMedia({ mediaKey: 'short', url: 'https://mmg.whatsapp.net/x' }, 'image', { fetch: fetchSpy }),
      'INVALID_INPUT'
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects tampered files with INVALID_MAC', async () => {
    const fixture = encryptMediaForTest(randomBytes(500), 'document');
    const tampered = Buffer.from(fixture.encrypted);
    tampered[100] = (tampered[100] ?? 0) ^ 0xff;
    routes.set('/tampered.enc', serveBuffer(tampered));
    await expectRejection(
      downloadAndDecryptMedia({ mediaKey: fixture.mediaKey, url: `${server.origin}/tampered.enc` }, 'document', {
        allowUrl: allowLocalhost,
      }),
      'INVALID_MAC'
    );
  });

  it('maps HTTP errors to DOWNLOAD_FAILED with the status', async () => {
    const error = await expectRejection(
      downloadAndDecryptMedia({ mediaKey: randomBytes(32), url: `${server.origin}/missing.enc` }, 'image', {
        allowUrl: allowLocalhost,
      }),
      'DOWNLOAD_FAILED'
    );
    expect(error.details?.status).toBe(404);
  });

  it('enforces the size limit from Content-Length', async () => {
    const { mediaKey, url } = publish('/big.enc', 4096);
    const error = await expectRejection(
      downloadAndDecryptMedia({ mediaKey, url }, 'image', { allowUrl: allowLocalhost, maxBytes: 1024 }),
      'TOO_LARGE'
    );
    expect(error.details?.contentLength).toBeGreaterThan(1024);
  });

  it('enforces the size limit while streaming (no Content-Length)', async () => {
    routes.set('/chunked.enc', (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/octet-stream' });
      const chunk = randomBytes(16 * 1024);
      let sent = 0;
      const push = () => {
        if (sent >= 64 || res.destroyed) {
          res.end();
          return;
        }
        sent += 1;
        res.write(chunk, () => setImmediate(push));
      };
      push();
    });
    await expectRejection(
      downloadAndDecryptMedia({ mediaKey: randomBytes(32), url: `${server.origin}/chunked.enc` }, 'image', {
        allowUrl: allowLocalhost,
        maxBytes: 100 * 1024,
      }),
      'TOO_LARGE'
    );
  });

  it('times out slow downloads', async () => {
    routes.set('/slow.enc', (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/octet-stream' });
      res.write(Buffer.alloc(16));
      // never ends
    });
    const startedAt = Date.now();
    await expectRejection(
      downloadAndDecryptMedia({ mediaKey: randomBytes(32), url: `${server.origin}/slow.enc` }, 'image', {
        allowUrl: allowLocalhost,
        timeoutMs: 150,
      }),
      'TIMEOUT'
    );
    expect(Date.now() - startedAt).toBeLessThan(2000);
  });

  it('honours caller cancellation', async () => {
    routes.set('/hang.enc', () => {
      // never responds
    });
    const controller = new AbortController();
    const pending = downloadAndDecryptMedia({ mediaKey: randomBytes(32), url: `${server.origin}/hang.enc` }, 'image', {
      allowUrl: allowLocalhost,
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 20);
    await expectRejection(pending, 'DOWNLOAD_FAILED');
  });

  it('follows redirects only to allowed hosts', async () => {
    const { mediaKey, plaintext } = publish('/final.enc', 100);
    routes.set('/redirect-ok', (_req, res) => {
      res.writeHead(302, { location: '/final.enc' });
      res.end();
    });
    routes.set('/redirect-evil', (_req, res) => {
      res.writeHead(302, { location: 'https://evil.example/steal' });
      res.end();
    });
    routes.set('/redirect-loop', (_req, res) => {
      res.writeHead(302, { location: '/redirect-loop' });
      res.end();
    });

    const followed = await downloadAndDecryptMedia({ mediaKey, url: `${server.origin}/redirect-ok` }, 'image', {
      allowUrl: allowLocalhost,
    });
    expect(followed.equals(plaintext)).toBe(true);

    await expectRejection(
      downloadAndDecryptMedia({ mediaKey, url: `${server.origin}/redirect-evil` }, 'image', { allowUrl: allowLocalhost }),
      'HOST_NOT_ALLOWED'
    );
    await expectRejection(
      downloadAndDecryptMedia({ mediaKey, url: `${server.origin}/redirect-loop` }, 'image', { allowUrl: allowLocalhost }),
      'DOWNLOAD_FAILED'
    );
  });

  it('verifies fileEncSha256/fileSha256 from the message when well formed', async () => {
    const { mediaKey, url, fileSha256 } = publish('/hash.enc', 100);
    await expectRejection(
      downloadAndDecryptMedia({ mediaKey, url, fileSha256: Buffer.alloc(32) }, 'image', { allowUrl: allowLocalhost }),
      'HASH_MISMATCH'
    );
    // malformed digests are ignored (not every payload carries them correctly)
    const plaintext = await downloadAndDecryptMedia({ mediaKey, url, fileSha256: 'abc' }, 'image', {
      allowUrl: allowLocalhost,
    });
    expect(plaintext.length).toBe(100);
    expect(fileSha256.length).toBe(32);
  });
});

describe('downloadAndDecryptMessageMedia', () => {
  it('downloads the media of a WAMessage-shaped object', async () => {
    const { mediaKey, plaintext, url } = publish('/message.enc', 300, 'document');
    const result = await downloadAndDecryptMessageMedia(
      {
        key: { id: 'X' },
        message: { documentWithCaptionMessage: { message: { documentMessage: { url, mediaKey: mediaKey.toString('base64') } } } },
      },
      { allowUrl: allowLocalhost }
    );
    expect(result.mediaType).toBe('document');
    expect(result.buffer.equals(plaintext)).toBe(true);
  });
});
