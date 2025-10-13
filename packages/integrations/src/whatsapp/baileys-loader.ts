import './libsignal-polyfill';

export type BaileysModule = typeof import('@whiskeysockets/baileys');

let baileysModulePromise: Promise<BaileysModule> | null = null;

export const loadBaileysModule = async (): Promise<BaileysModule> => {
  if (!baileysModulePromise) {
    baileysModulePromise = import('@whiskeysockets/baileys');
  }

  return baileysModulePromise;
};
