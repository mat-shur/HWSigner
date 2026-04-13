import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemInstruction,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';

import { InvalidTransactionError } from './errors';
import { bytesToBase64 } from './message';
import type {
  SignedTransactionResult,
  TransactionSummary,
  TransactionSummaryInstruction,
  TransactionSigningPayloadMode,
} from './types';

export const DEFAULT_PLAYGROUND_RECIPIENT = 'DRpbCBMxVnDK7maPMoGQfFiRLNGhFM1M7J9sX9g3BJ2j';
export const DEFAULT_PLAYGROUND_LAMPORTS = 1_500_000;
export const MOCK_DEVNET_BLOCKHASH = bs58.encode(new Uint8Array(32).fill(7));

export function createPlaygroundTransaction(params: {
  fromAddress: string;
  toAddress?: string;
  lamports?: number;
  recentBlockhash?: string;
}): Transaction {
  const from = new PublicKey(params.fromAddress);
  const to = new PublicKey(params.toAddress ?? DEFAULT_PLAYGROUND_RECIPIENT);
  const lamports = params.lamports ?? DEFAULT_PLAYGROUND_LAMPORTS;
  const recentBlockhash = params.recentBlockhash ?? MOCK_DEVNET_BLOCKHASH;

  const transaction = new Transaction({
    feePayer: from,
    recentBlockhash,
  });

  transaction.add(
    SystemProgram.transfer({
      fromPubkey: from,
      toPubkey: to,
      lamports,
    }),
  );

  return transaction;
}

export function createPlaygroundVersionedTransaction(params: {
  fromAddress: string;
  toAddress?: string;
  lamports?: number;
  recentBlockhash?: string;
}): VersionedTransaction {
  const legacy = createPlaygroundTransaction(params);
  const message = new TransactionMessage({
    payerKey: legacy.feePayer ?? new PublicKey(params.fromAddress),
    recentBlockhash: legacy.recentBlockhash || params.recentBlockhash || MOCK_DEVNET_BLOCKHASH,
    instructions: legacy.instructions,
  }).compileToV0Message();

  return new VersionedTransaction(message);
}

export function serializeTransactionForLedger(transaction: Transaction | VersionedTransaction): {
  bytes: Uint8Array;
  version: 'legacy' | 'v0';
  recentBlockhash: string;
} {
  if (transaction instanceof VersionedTransaction) {
    return {
      bytes: transaction.serialize(),
      version: 'v0',
      recentBlockhash: transaction.message.recentBlockhash,
    };
  }

  return {
    bytes: transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    }),
    version: 'legacy',
    recentBlockhash: getLegacyRecentBlockhash(transaction),
  };
}

export function buildLedgerTransactionSigningPayloads(serializedTransaction: Uint8Array): Array<{
  mode: TransactionSigningPayloadMode;
  bytes: Uint8Array;
  length: number;
}> {
  const payloads: Array<{
    mode: TransactionSigningPayloadMode;
    bytes: Uint8Array;
    length: number;
  }> = [];

  const pushPayload = (mode: TransactionSigningPayloadMode, bytes: Uint8Array | null) => {
    if (!bytes || bytes.length === 0) {
      return;
    }

    if (payloads.some((candidate) => sameBytes(candidate.bytes, bytes))) {
      return;
    }

    payloads.push({
      mode,
      bytes,
      length: bytes.length,
    });
  };

  pushPayload('serialized-transaction', Uint8Array.from(serializedTransaction));
  pushPayload('legacy-message-bytes', extractLegacyTransactionMessageBytes(serializedTransaction));
  pushPayload('versioned-message-bytes', extractVersionedTransactionMessageBytes(serializedTransaction));

  return payloads;
}

export function resolveLedgerTransactionSigningPayload(
  serializedTransaction: Uint8Array,
  mode: TransactionSigningPayloadMode,
): {
  mode: TransactionSigningPayloadMode;
  bytes: Uint8Array;
  length: number;
} {
  const payload = buildLedgerTransactionSigningPayloads(serializedTransaction)
    .find((candidate) => candidate.mode === mode);

  if (!payload) {
    throw new InvalidTransactionError(`The signing mode "${mode}" is not available for this transaction.`);
  }

  return payload;
}

export function applyLedgerSignature(transaction: Transaction, signerAddress: string, signature: Uint8Array): {
  version: 'legacy';
  recentBlockhash: string;
  serializedTransactionBase64: string;
  signatureBase58: string;
} {
  const unsigned = Transaction.from(
    transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    }),
  );

  unsigned.addSignature(new PublicKey(signerAddress), Buffer.from(signature));

  return {
    version: 'legacy',
    recentBlockhash: getLegacyRecentBlockhash(unsigned),
    serializedTransactionBase64: bytesToBase64(
      unsigned.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      }),
    ),
    signatureBase58: bs58.encode(signature),
  };
}

export function applyLedgerSignatureToVersioned(
  transaction: VersionedTransaction,
  signature: Uint8Array,
): {
  version: 'v0';
  recentBlockhash: string;
  serializedTransactionBase64: string;
  signatureBase58: string;
} {
  const cloned = VersionedTransaction.deserialize(transaction.serialize());
  cloned.signatures[0] = signature;

  return {
    version: 'v0',
    recentBlockhash: cloned.message.recentBlockhash,
    serializedTransactionBase64: bytesToBase64(cloned.serialize()),
    signatureBase58: bs58.encode(signature),
  };
}

export function summarizeTransaction(transaction: Transaction | VersionedTransaction): TransactionSummary {
  if (transaction instanceof VersionedTransaction) {
    return summarizeVersionedTransaction(transaction);
  }

  return summarizeLegacyTransaction(transaction);
}

export function buildSignedLegacyResult(params: {
  transaction: Transaction;
  signerAddress: string;
  derivationPath: string;
} & Pick<SignedTransactionResult, 'address'> & {
  signature: Uint8Array;
}): SignedTransactionResult {
  const signed = applyLedgerSignature(params.transaction, params.signerAddress, params.signature);

  return {
    address: params.address,
    derivationPath: params.derivationPath,
    signature: signed.signatureBase58,
    version: signed.version,
    recentBlockhash: signed.recentBlockhash,
    serializedTransactionBase64: signed.serializedTransactionBase64,
    transactionSummary: summarizeLegacyTransaction(params.transaction),
  };
}

export function buildSignedVersionedResult(params: {
  transaction: VersionedTransaction;
  derivationPath: string;
  address: string;
  signature: Uint8Array;
}): SignedTransactionResult {
  const signed = applyLedgerSignatureToVersioned(params.transaction, params.signature);

  return {
    address: params.address,
    derivationPath: params.derivationPath,
    signature: signed.signatureBase58,
    version: signed.version,
    recentBlockhash: signed.recentBlockhash,
    serializedTransactionBase64: signed.serializedTransactionBase64,
    transactionSummary: summarizeVersionedTransaction(params.transaction),
  };
}

export function assertTransactionHasFeePayer(transaction: Transaction): string {
  const payer = transaction.feePayer?.toBase58();

  if (!payer) {
    throw new InvalidTransactionError('Legacy transactions must set feePayer before signing.');
  }

  return payer;
}

function summarizeLegacyTransaction(transaction: Transaction): TransactionSummary {
  const from = assertTransactionHasFeePayer(transaction);
  const transfer = findTransferInstruction(transaction.instructions);

  return {
    network: 'devnet (offline)',
    version: 'legacy',
    type: transfer?.type ?? 'Transaction',
    from,
    to: transfer?.to ?? 'Unknown',
    amount: transfer?.amount ?? 'Unknown',
    recentBlockhash: getLegacyRecentBlockhash(transaction),
    instructions: transaction.instructions.map(summarizeInstruction),
  };
}

function summarizeVersionedTransaction(transaction: VersionedTransaction): TransactionSummary {
  return {
    network: 'devnet (offline)',
    version: 'v0',
    type: 'Versioned Transaction',
    from: transaction.message.staticAccountKeys[0]?.toBase58() ?? 'Unknown',
    to: 'Derived from compiled instructions',
    amount: 'Unavailable offline',
    recentBlockhash: transaction.message.recentBlockhash,
    instructions: transaction.message.compiledInstructions.map((instruction) => ({
      program: transaction.message.staticAccountKeys[instruction.programIdIndex]?.toBase58() ?? 'Unknown',
      type: 'Compiled Instruction',
      data: `${instruction.data.length} bytes`,
    })),
  };
}

function findTransferInstruction(instructions: TransactionInstruction[]): {
  type: string;
  to: string;
  amount: string;
} | null {
  for (const instruction of instructions) {
    if (!instruction.programId.equals(SystemProgram.programId)) {
      continue;
    }

    try {
      const type = SystemInstruction.decodeInstructionType(instruction);
      if (type !== 'Transfer') {
        continue;
      }

      const decoded = SystemInstruction.decodeTransfer(instruction);
      return {
        type,
        to: decoded.toPubkey.toBase58(),
        amount: formatLamports(Number(decoded.lamports)),
      };
    } catch {
      continue;
    }
  }

  return null;
}

function summarizeInstruction(instruction: TransactionInstruction): TransactionSummaryInstruction {
  if (instruction.programId.equals(SystemProgram.programId)) {
    try {
      const type = SystemInstruction.decodeInstructionType(instruction);
      if (type === 'Transfer') {
        const decoded = SystemInstruction.decodeTransfer(instruction);
        return {
          program: 'System Program',
          type,
          data: `${formatLamports(Number(decoded.lamports))} -> ${shortAddress(decoded.toPubkey.toBase58())}`,
        };
      }

      return {
        program: 'System Program',
        type,
        data: `${instruction.data.length} bytes`,
      };
    } catch {
      return {
        program: 'System Program',
        type: 'Instruction',
        data: `${instruction.data.length} bytes`,
      };
    }
  }

  return {
    program: shortAddress(instruction.programId.toBase58()),
    type: 'Instruction',
    data: `${instruction.data.length} bytes`,
  };
}

function formatLamports(lamports: number): string {
  return `${(lamports / LAMPORTS_PER_SOL).toLocaleString(undefined, {
    maximumFractionDigits: 9,
  })} SOL`;
}

function shortAddress(address: string): string {
  if (address.length <= 12) {
    return address;
  }

  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function getLegacyRecentBlockhash(transaction: Transaction): string {
  return transaction.recentBlockhash || MOCK_DEVNET_BLOCKHASH;
}

function extractLegacyTransactionMessageBytes(serializedTransaction: Uint8Array): Uint8Array | null {
  try {
    const transaction = Transaction.from(Buffer.from(serializedTransaction));
    const reserialized = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    if (!sameBytes(serializedTransaction, reserialized)) {
      return null;
    }

    return Uint8Array.from(transaction.serializeMessage());
  } catch {
    return null;
  }
}

function extractVersionedTransactionMessageBytes(serializedTransaction: Uint8Array): Uint8Array | null {
  try {
    const transaction = VersionedTransaction.deserialize(serializedTransaction);
    const reserialized = transaction.serialize();

    if (!sameBytes(serializedTransaction, reserialized)) {
      return null;
    }

    return Uint8Array.from(transaction.message.serialize());
  } catch {
    return null;
  }
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}