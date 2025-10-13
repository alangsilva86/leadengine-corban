import { createRequire } from 'module';

type CryptoModuleWithPolyfill = {
  HKDF?: (seed: Buffer, salt: Buffer, info: Buffer) => [Buffer, Buffer, Buffer];
  deriveSecrets?: (seed: Buffer, salt: Buffer, info: Buffer) => [Buffer, Buffer, Buffer];
  [key: string]: unknown;
};

// @ts-expect-error NodeNext modules support `import.meta` for createRequire resolution.
const baseRequire = createRequire(import.meta.url);
const baileysEntryPath = baseRequire.resolve('@whiskeysockets/baileys');
const baileysRequire = createRequire(baileysEntryPath);
const crypto = baileysRequire('libsignal/src/crypto.js') as CryptoModuleWithPolyfill;

if (typeof crypto.deriveSecrets !== 'function') {
  if (typeof crypto.HKDF === 'function') {
    const deriveSecrets = (seed: Buffer, salt: Buffer, info: Buffer) => crypto.HKDF!(seed, salt, info);
    Object.defineProperty(crypto, 'deriveSecrets', {
      value: deriveSecrets,
      configurable: true,
      enumerable: true,
      writable: true
    });
  } else {
    throw new Error('libsignal crypto module is missing HKDF implementation required by Baileys.');
  }
}
