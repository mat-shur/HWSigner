import { Keypair, VersionedTransaction } from '@solana/web3.js';
import { describe, expect, it } from 'vitest';

import {
  buildLedgerTransactionSigningPayloads,
  buildSignedLegacyResult,
  buildSignedVersionedResult,
  createPlaygroundTransaction,
  createPlaygroundVersionedTransaction,
  resolveLedgerTransactionSigningPayload,
  serializeTransactionForLedger,
} from './transactions';

describe('transaction helpers', () => {
  it('serializes a legacy transaction for Ledger signing', () => {
    const signer = Keypair.generate();
    const transaction = createPlaygroundTransaction({
      fromAddress: signer.publicKey.toBase58(),
    });

    const serialized = serializeTransactionForLedger(transaction);

    expect(serialized.version).toBe('legacy');
    expect(serialized.bytes.length).toBeGreaterThan(0);
  });

  it('serializes a versioned transaction for Ledger signing', () => {
    const signer = Keypair.generate();
    const transaction = createPlaygroundVersionedTransaction({
      fromAddress: signer.publicKey.toBase58(),
    });

    const serialized = serializeTransactionForLedger(transaction);

    expect(serialized.version).toBe('v0');
    expect(serialized.bytes.length).toBeGreaterThan(0);
    expect(() => VersionedTransaction.deserialize(serialized.bytes)).not.toThrow();
  });

  it('builds legacy transaction signing payload candidates with a message-bytes fallback', () => {
    const signer = Keypair.generate();
    const transaction = createPlaygroundTransaction({
      fromAddress: signer.publicKey.toBase58(),
    });
    const serialized = serializeTransactionForLedger(transaction);

    const payloads = buildLedgerTransactionSigningPayloads(serialized.bytes);

    expect(payloads.map((payload) => payload.mode)).toEqual([
      'serialized-transaction',
      'legacy-message-bytes',
    ]);
    expect(payloads[1]?.bytes).toEqual(Uint8Array.from(transaction.serializeMessage()));
  });

  it('builds versioned transaction signing payload candidates with a message-bytes fallback', () => {
    const signer = Keypair.generate();
    const transaction = createPlaygroundVersionedTransaction({
      fromAddress: signer.publicKey.toBase58(),
    });
    const serialized = serializeTransactionForLedger(transaction);

    const payloads = buildLedgerTransactionSigningPayloads(serialized.bytes);

    expect(payloads.map((payload) => payload.mode)).toEqual([
      'serialized-transaction',
      'versioned-message-bytes',
    ]);
    expect(payloads[1]?.bytes).toEqual(Uint8Array.from(transaction.message.serialize()));
  });

  it('resolves an explicitly selected signing payload mode', () => {
    const signer = Keypair.generate();
    const transaction = createPlaygroundTransaction({
      fromAddress: signer.publicKey.toBase58(),
    });
    const serialized = serializeTransactionForLedger(transaction);

    const payload = resolveLedgerTransactionSigningPayload(serialized.bytes, 'legacy-message-bytes');

    expect(payload.mode).toBe('legacy-message-bytes');
    expect(payload.bytes).toEqual(Uint8Array.from(transaction.serializeMessage()));
  });

  it('builds a signed legacy result from a Ledger signature', () => {
    const signer = Keypair.generate();
    const transaction = createPlaygroundTransaction({
      fromAddress: signer.publicKey.toBase58(),
    });

    transaction.sign(signer);

    const signature = transaction.signatures[0].signature;
    if (!signature) {
      throw new Error('Expected a signature on the signed legacy transaction.');
    }

    const result = buildSignedLegacyResult({
      transaction,
      signerAddress: signer.publicKey.toBase58(),
      address: signer.publicKey.toBase58(),
      derivationPath: "m/44'/501'/0'/0'",
      signature,
    });

    expect(result.version).toBe('legacy');
    expect(result.signature.length).toBeGreaterThan(0);
    expect(result.serializedTransactionBase64.length).toBeGreaterThan(0);
  });

  it('builds a signed versioned result from a Ledger signature', () => {
    const signer = Keypair.generate();
    const transaction = createPlaygroundVersionedTransaction({
      fromAddress: signer.publicKey.toBase58(),
    });

    const signed = VersionedTransaction.deserialize(transaction.serialize());
    signed.sign([signer]);

    const signature = signed.signatures[0];
    const result = buildSignedVersionedResult({
      transaction,
      address: signer.publicKey.toBase58(),
      derivationPath: "m/44'/501'/0'/0'",
      signature,
    });

    expect(result.version).toBe('v0');
    expect(result.signature.length).toBeGreaterThan(0);
    expect(result.serializedTransactionBase64.length).toBeGreaterThan(0);
  });
});