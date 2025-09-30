import baileys from 'baileys';
import * as libsignal from 'libsignal';

async function main() {
  console.log('Baileys broker dependency check starting...');
  const exportedKeys = Object.keys(baileys);
  if (!exportedKeys.length) {
    throw new Error('Baileys exports are empty');
  }

  if (typeof libsignal.KeyHelper?.generateIdentityKeyPair !== 'function') {
    throw new Error('libsignal KeyHelper API is unavailable');
  }

  console.log('Baileys exports available:', exportedKeys.slice(0, 5).join(', ') || '(none)');
  console.log('libsignal KeyHelper functions ready.');
  console.log('Dependencies resolved successfully without Git fetch.');
}

main().catch((error) => {
  console.error('Failed dependency check:', error);
  process.exitCode = 1;
});
