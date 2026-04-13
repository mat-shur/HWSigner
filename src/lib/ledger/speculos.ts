import { Transaction, VersionedTransaction } from '@solana/web3.js';
import {
  DeviceActionStatus,
  DeviceManagementKitBuilder,
  type DeviceManagementKit,
  type ExecuteDeviceActionReturnType,
} from '@ledgerhq/device-management-kit';
import { SignMessageVersion, SignerSolanaBuilder } from '@ledgerhq/device-signer-kit-solana';
import { speculosIdentifier, speculosTransportFactory } from '@ledgerhq/device-transport-kit-speculos';
import { firstValueFrom, timeout } from 'rxjs';

import { getLedgerCapabilities } from '../hwsigner/capabilities';
import { getSolanaDerivationPaths, resolveDerivationPath, toLedgerDerivationPath } from '../hwsigner/derivation';
import {
  AdapterInitializationError,
  InvalidTransactionError,
  UnsupportedOperationError,
  getErrorMessage,
} from '../hwsigner/errors';
import { bytesToBase64, messageToDisplayText, normalizeMessageBytes } from '../hwsigner/message';
import {
  buildSignedLegacyResult,
  buildSignedVersionedResult,
  resolveLedgerTransactionSigningPayload,
  serializeTransactionForLedger,
} from '../hwsigner/transactions';
import type {
  GetAccountsInput,
  HWSignerAccount,
  HWSignerAppConfiguration,
  HWSignerConnection,
  SignMessageInput,
  SignedMessageResult,
  SignedTransactionResult,
  SignTransactionInput,
  SignVersionedTransactionInput,
  TransactionSigningPayloadMode,
} from '../hwsigner/types';
import { resolveLedgerDeviceAction } from './action';
import { DEFAULT_SPECULOS_API_BASE_URL, isSpeculosEnabled, resolveSpeculosUrl } from './env';
import { deleteSpeculosSession, requireSpeculosSession, saveSpeculosSession } from './session-store';

const SPECULOS_DISCOVERY_TIMEOUT_MS = 5_000;

export async function connectSpeculosSession(options?: {
  speculosUrl?: string;
}): Promise<{
  sessionToken: string;
  connection: HWSignerConnection;
  speculosUrl: string;
}> {
  ensureSpeculosEnabled();

  const speculosUrl = validateSpeculosUrl(resolveSpeculosUrl(options?.speculosUrl));
  const dmk = createSpeculosDmk(speculosUrl);
  const discoveredDevice = await firstValueFrom(
    dmk.startDiscovering({ transport: speculosIdentifier }).pipe(
      timeout({
        first: SPECULOS_DISCOVERY_TIMEOUT_MS,
      }),
    ),
  ).catch((error: unknown) => {
    throw new AdapterInitializationError(`Could not reach Speculos at ${speculosUrl}.`, { cause: error });
  });

  const sessionId = await dmk.connect({
    device: discoveredDevice,
    sessionRefresherOptions: {
      isRefresherDisabled: true,
    },
  });

  const storedSession = saveSpeculosSession({
    dmk,
    sessionId,
    speculosUrl,
  });

  const appConfiguration = await safeGetAppConfiguration(dmk, sessionId);

  return {
    sessionToken: storedSession.token,
    speculosUrl,
    connection: {
      walletId: 'ledger',
      walletName: 'Ledger',
      runtime: {
        kind: 'speculos',
        apiBaseUrl: DEFAULT_SPECULOS_API_BASE_URL,
      },
      capabilities: getLedgerCapabilities({
        kind: 'speculos',
        apiBaseUrl: DEFAULT_SPECULOS_API_BASE_URL,
      }),
      appConfiguration,
    },
  };
}

export async function disconnectSpeculosSession(sessionToken: string): Promise<void> {
  const session = deleteSpeculosSession(sessionToken);

  if (!session) {
    return;
  }

  try {
    await session.dmk.disconnect({
      sessionId: session.sessionId,
    });
  } finally {
    session.dmk.close();
  }
}

export async function getSpeculosAccounts(
  sessionToken: string,
  input: GetAccountsInput,
): Promise<HWSignerAccount[]> {
  const session = requireSpeculosSession(sessionToken);
  const signer = getSigner(session.dmk, session.sessionId);
  const paths = getSolanaDerivationPaths(input.startIndex, input.count);
  const accounts: HWSignerAccount[] = [];

  for (let index = 0; index < paths.length; index += 1) {
    const path = paths[index];
    const ledgerPath = toLedgerDerivationPath(path);
    const address = await resolveLedgerDeviceAction(
      signer.getAddress(ledgerPath, {
        checkOnDevice: input.checkOnDevice,
        skipOpenApp: index > 0,
      }),
      {
        operation: `Derive account ${path}`,
      },
    );

    accounts.push({
      index: input.startIndex + index,
      path,
      address,
    });
  }

  return accounts;
}

export async function signSpeculosMessage(
  sessionToken: string,
  input: SignMessageInput,
): Promise<SignedMessageResult> {
  const session = requireSpeculosSession(sessionToken);
  const signer = getSigner(session.dmk, session.sessionId);
  const derivationPath = resolveDerivationPath(input);
  const ledgerPath = toLedgerDerivationPath(derivationPath);
  const address = await lookupAddress(signer, derivationPath, false);
  const messageBytes = normalizeMessageBytes(input.message);
  const output = await signSpeculosMessagePayload({
    signer,
    ledgerPath,
    derivationPath,
    message: input.message,
    messageBytes,
  });

  return {
    address,
    derivationPath,
    message: messageToDisplayText(input.message),
    messageBytesBase64: bytesToBase64(messageBytes),
    signature: output.signature,
    verified: null,
  };
}

export async function signSpeculosTransaction(
  sessionToken: string,
  input: SignTransactionInput,
): Promise<SignedTransactionResult> {
  const session = requireSpeculosSession(sessionToken);
  const signer = getSigner(session.dmk, session.sessionId);
  const derivationPath = resolveDerivationPath(input);
  const ledgerPath = toLedgerDerivationPath(derivationPath);
  const address = await lookupAddress(signer, derivationPath, false);
  const serialized = serializeTransactionForLedger(input.transaction);
  const signature = await signSpeculosTransactionBytes(
    signer,
    ledgerPath,
    derivationPath,
    serialized.bytes,
    serialized.version,
    input.signingPayloadMode,
  );

  return buildSignedLegacyResult({
    transaction: input.transaction,
    signerAddress: address,
    address,
    derivationPath,
    signature,
  });
}

export async function signSpeculosVersionedTransaction(
  sessionToken: string,
  input: SignVersionedTransactionInput,
): Promise<SignedTransactionResult> {
  const session = requireSpeculosSession(sessionToken);
  const signer = getSigner(session.dmk, session.sessionId);
  const derivationPath = resolveDerivationPath(input);
  const ledgerPath = toLedgerDerivationPath(derivationPath);
  const address = await lookupAddress(signer, derivationPath, false);
  const serialized = serializeTransactionForLedger(input.transaction);
  const signature = await signSpeculosTransactionBytes(
    signer,
    ledgerPath,
    derivationPath,
    serialized.bytes,
    serialized.version,
    input.signingPayloadMode,
  );

  return buildSignedVersionedResult({
    transaction: input.transaction,
    derivationPath,
    address,
    signature,
  });
}

export async function signSpeculosSerializedTransaction(
  sessionToken: string,
  input: {
    derivationPath?: string;
    accountIndex?: number;
    serializedTransaction: Uint8Array;
    version: 'legacy' | 'v0';
    signingPayloadMode?: TransactionSigningPayloadMode;
  },
): Promise<SignedTransactionResult> {
  const session = requireSpeculosSession(sessionToken);
  const signer = getSigner(session.dmk, session.sessionId);
  const derivationPath = resolveDerivationPath(input);
  const ledgerPath = toLedgerDerivationPath(derivationPath);
  const address = await lookupAddress(signer, derivationPath, false);
  const signature = await signSpeculosTransactionBytes(
    signer,
    ledgerPath,
    derivationPath,
    input.serializedTransaction,
    input.version,
    input.signingPayloadMode,
  );

  if (input.version === 'v0') {
    return buildSignedVersionedResult({
      transaction: VersionedTransaction.deserialize(input.serializedTransaction),
      derivationPath,
      address,
      signature,
    });
  }

  return buildSignedLegacyResult({
    transaction: Transaction.from(input.serializedTransaction),
    signerAddress: address,
    address,
    derivationPath,
    signature,
  });
}

export async function getSpeculosAppConfiguration(sessionToken: string): Promise<HWSignerAppConfiguration | null> {
  const session = requireSpeculosSession(sessionToken);
  return safeGetAppConfiguration(session.dmk, session.sessionId);
}

export function validateSpeculosUrl(value: string): string {
  try {
    const url = new URL(value);

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new UnsupportedOperationError(`Unsupported Speculos protocol in "${value}".`);
    }

    return url.toString().replace(/\/$/, '');
  } catch (error) {
    if (error instanceof UnsupportedOperationError) {
      throw error;
    }

    throw new AdapterInitializationError(`Invalid Speculos URL: "${value}".`, { cause: error });
  }
}

function ensureSpeculosEnabled() {
  if (!isSpeculosEnabled()) {
    throw new UnsupportedOperationError('Speculos is disabled. Set NEXT_PUBLIC_ENABLE_SPECULOS=true in local development.');
  }
}

function createSpeculosDmk(speculosUrl: string): DeviceManagementKit {
  return new DeviceManagementKitBuilder().addTransport(speculosTransportFactory(speculosUrl)).build();
}

function getSigner(dmk: DeviceManagementKit, sessionId: string) {
  return new SignerSolanaBuilder({
    dmk,
    sessionId,
    originToken: 'HWSigner',
  }).build();
}

async function safeGetAppConfiguration(
  dmk: DeviceManagementKit,
  sessionId: string,
): Promise<HWSignerAppConfiguration | null> {
  const signer = getSigner(dmk, sessionId);

  try {
    const configuration = await resolveLedgerDeviceAction(signer.getAppConfiguration(), {
      operation: 'Read Solana app configuration',
    });

    return {
      blindSigningEnabled: configuration.blindSigningEnabled,
      pubKeyDisplayMode: String(configuration.pubKeyDisplayMode),
      version: configuration.version,
    };
  } catch (error) {
    const message = getErrorMessage(error);
    if (message) {
      return null;
    }

    return null;
  }
}

async function lookupAddress(
  signer: ReturnType<typeof getSigner>,
  derivationPath: string,
  skipOpenApp: boolean,
): Promise<string> {
  const ledgerPath = toLedgerDerivationPath(derivationPath);
  return resolveLedgerDeviceAction(
    signer.getAddress(ledgerPath, {
      checkOnDevice: false,
      skipOpenApp,
    }),
    {
      operation: `Resolve address for ${derivationPath}`,
    },
  );
}

async function signSpeculosTransactionBytes(
  signer: ReturnType<typeof getSigner>,
  ledgerPath: string,
  derivationPath: string,
  serializedTransaction: Uint8Array,
  version: 'legacy' | 'v0',
  signingPayloadMode?: TransactionSigningPayloadMode,
): Promise<Uint8Array> {
  const payloadMode = signingPayloadMode ?? 'serialized-transaction';
  const payload = resolveLedgerTransactionSigningPayload(serializedTransaction, payloadMode);

  try {
    const output = await waitForSpeculosAction(
      signer.signTransaction(ledgerPath, payload.bytes),
    );

    return normalizeTransactionSignature(output);
  } catch (error) {
    if (isInvalidOffchainHeader(error)) {
      throw new InvalidTransactionError(
        `Ledger rejected the ${payload.mode} payload with an invalid off-chain message header.`,
        { cause: error },
      );
    }

    throw error;
  }
}

async function signSpeculosMessagePayload(params: {
  signer: ReturnType<typeof getSigner>;
  ledgerPath: string;
  derivationPath: string;
  message: string | Uint8Array;
  messageBytes: Uint8Array;
}): Promise<{ signature: string }> {
  if (typeof params.message !== 'string') {
    return resolveLedgerDeviceAction(
      params.signer.signMessage(params.ledgerPath, params.messageBytes, {
        version: SignMessageVersion.Raw,
      }),
      {
        operation: `Sign raw message with ${params.derivationPath}`,
      },
    );
  }

  return resolveLedgerDeviceAction(
    params.signer.signMessage(params.ledgerPath, params.message, {
      version: SignMessageVersion.V0,
      appDomain: 'localhost',
    }),
    {
      operation: `Sign message with ${params.derivationPath}`,
    },
  );
}

function isInvalidOffchainHeader(error: unknown): boolean {
  return getErrorMessage(error) === 'Invalid off-chain message header';
}

function waitForSpeculosAction<Output, ActionError, IntermediateValue>(
  action: ExecuteDeviceActionReturnType<Output, ActionError, IntermediateValue>,
): Promise<Output> {
  return new Promise<Output>((resolve, reject) => {
    let subscription: { unsubscribe(): void } | null = null;

    const cleanup = () => {
      subscription?.unsubscribe();
    };

    subscription = action.observable.subscribe({
      next: (event) => {
        if (event.status === DeviceActionStatus.Completed) {
          cleanup();
          resolve(event.output);
        }

        if (event.status === DeviceActionStatus.Error) {
          cleanup();
          reject(event.error);
        }
      },
      error: (error) => {
        cleanup();
        reject(error);
      },
    });
  });
}

function normalizeTransactionSignature(output: unknown): Uint8Array {
  if (output instanceof Uint8Array) {
    return Uint8Array.from(output);
  }

  if (Array.isArray(output)) {
    return Uint8Array.from(output);
  }

  throw new Error('Ledger did not return a transaction signature.');
}