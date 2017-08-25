'use strict';

const NATIVE_WIN32 = ['none'];
const NATIVE_OTHER = [
  'secp256k1',
  '@ronomon/reed-solomon',
  'utf-8-validate',
  'bufferutil'
];


if (process.platform === 'win32') {
  process.stdout.write(NATIVE_WIN32.join(','));
} else {
  process.stdout.write(NATIVE_OTHER.join(','));
}
