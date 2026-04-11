import { createPublicKey, verify } from 'node:crypto';

import bs58 from 'bs58';

import { normalizeMessageBytes } from '@/lib/hwsigner/message';

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export function verifyDetachedSignature(input: {
  message: string | Uint8Array;
  signatureBase58: string;
  publicKeyBase58: string;
}): boolean {
  const publicKey = createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(bs58.decode(input.publicKeyBase58))]),
    format: 'der',
    type: 'spki',
  });

  return verify(
    null,
    Buffer.from(normalizeMessageBytes(input.message)),
    publicKey,
    Buffer.from(bs58.decode(input.signatureBase58)),
  );
}
