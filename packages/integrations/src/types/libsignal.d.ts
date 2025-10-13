declare module 'libsignal/src/crypto.js' {
  export function HKDF(seed: Buffer, salt: Buffer, info: Buffer): [Buffer, Buffer, Buffer];
  export function encrypt(key: Buffer, data: Buffer, iv: Buffer): Buffer;
  export function decrypt(key: Buffer, data: Buffer, iv: Buffer): Buffer;
  export function sign(key: Buffer, data: Buffer): Buffer;
  export function hash(data: Buffer): Buffer;
  export function verifyMAC(data: Buffer, key: Buffer, mac: Buffer, length: number): void;
  export function createKeyPair(privKey?: Buffer): unknown;
  export function calculateAgreement(pubKey: Buffer, privKey: Buffer): Buffer;
  export function calculateSignature(privKey: Buffer, message: Buffer): Buffer;
  export function verifySignature(pubKey: Buffer, message: Buffer, sig: Buffer): boolean;
  export function generateKeyPair(privKey?: Buffer, message?: Buffer): unknown;
  export const deriveSecrets: ((seed: Buffer, salt: Buffer, info: Buffer) => [Buffer, Buffer, Buffer]) | undefined;
}
