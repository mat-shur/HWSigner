import { generateKeyPairSync, sign } from 'node:crypto';

import bs58 from 'bs58';
import { describe, expect, it } from 'vitest';

import { verifyDetachedSignature } from './signatures';

const SPKI_PREFIX_LENGTH = Buffer.from('302a300506032b6570032100', 'hex').length;

describe('signature helpers', () => {
  it('verifies detached Ed25519 signatures against a base58 Solana-style public key', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const message = new TextEncoder().encode('HWSigner signature helper');
    const signature = sign(null, Buffer.from(message), privateKey);
    const publicKeyDer = publicKey.export({
      format: 'der',
      type: 'spki',
    });
    const rawPublicKey = Buffer.from(publicKeyDer).subarray(SPKI_PREFIX_LENGTH);

    expect(verifyDetachedSignature({
      message,
      signatureBase58: bs58.encode(signature),
      publicKeyBase58: bs58.encode(rawPublicKey),
    })).toBe(true);
  });
});