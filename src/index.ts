'use client';

export { createHWSigner } from './lib/hwsigner/create-signer';
export {
  AdapterInitializationError,
  DeviceConnectionError,
  DeviceNotFoundError,
  HWSignerError,
  InvalidDerivationPathError,
  InvalidTransactionError,
  TimeoutError,
  UnknownWalletError,
  UnsupportedOperationError,
  UserRejectedError,
  getErrorCode,
  getErrorMessage,
  getErrorTag,
  isHWSignerError,
} from './lib/hwsigner/errors';
export {
  getSolanaDerivationPaths,
  parseSolanaDerivationPath,
  resolveDerivationPath,
  toLedgerDerivationPath,
} from './lib/hwsigner/derivation';
export {
  base64ToBytes,
  bytesToBase64,
  messageToDisplayText,
  normalizeMessageBytes,
} from './lib/hwsigner/message';
export {
  buildLedgerTransactionSigningPayloads,
  createPlaygroundTransaction,
  createPlaygroundVersionedTransaction,
  resolveLedgerTransactionSigningPayload,
  serializeTransactionForLedger,
  summarizeTransaction,
} from './lib/hwsigner/transactions';
export type { HWSignerErrorCode } from './lib/hwsigner/errors';
export type {
  CreateHWSignerOptions,
  GetAccountsInput,
  HWSignerAccount,
  HWSignerAppConfiguration,
  HWSignerCapabilities,
  HWSignerConnection,
  HWSignerEvent,
  HWSignerEventListener,
  HWSignerEventType,
  HWSignerRuntime,
  HWWalletId,
  SignMessageInput,
  SignedMessageResult,
  SignedTransactionResult,
  SignTransactionInput,
  SignVersionedTransactionInput,
  TransactionSigningPayloadMode,
  TransactionSummary,
  TransactionSummaryInstruction,
  WalletAdapter,
} from './lib/hwsigner/types';
