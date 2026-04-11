import { PublicKey } from '@solana/web3.js';
import { describe, expect, it, vi } from 'vitest';

import { AdapterInitializationError, UnsupportedOperationError } from '@/lib/hwsigner/errors';
import { createPlaygroundTransaction } from '@/lib/hwsigner/transactions';
import { createTangemAdapter } from '@/lib/tangem/adapter';
import {
  bytesToHex,
  extractTangemCardSession,
  extractTangemSignature,
  normalizeTangemSolanaPublicKey,
  TANGEM_SOLANA_DERIVATION_PATH,
} from '@/lib/tangem/client';
import type { TangemReactNativeSdk } from '@/lib/tangem/types';

const publicKeyBytes = Uint8Array.from(Array.from({ length: 32 }, (_, index) => index + 1));
const publicKeyHex = bytesToHex(publicKeyBytes);
const publicKeyAddress = new PublicKey(publicKeyBytes).toBase58();
const signatureHex = bytesToHex(Uint8Array.from(Array.from({ length: 64 }, (_, index) => index + 1)));

describe('Tangem adapter', () => {
  it('exposes WalletConnect capabilities', () => {
    const adapter = createTangemAdapter({
      kind: 'tangem-walletconnect',
      transport: 'qr',
    });

    expect(adapter.getCapabilities()).toMatchObject({
      connect: true,
      disconnect: true,
      getAccounts: true,
      signMessage: true,
      signTransaction: true,
      signVersionedTransaction: true,
      usb: false,
      ble: false,
      qr: true,
      nfc: true,
    });
  });

  it('exposes React Native NFC capabilities', () => {
    const adapter = createTangemAdapter({
      kind: 'tangem-react-native-nfc',
      transport: 'nfc',
    });

    expect(adapter.getCapabilities()).toMatchObject({
      connect: true,
      disconnect: true,
      getAccounts: true,
      signMessage: true,
      signTransaction: true,
      signVersionedTransaction: true,
      usb: false,
      ble: false,
      qr: false,
      nfc: true,
    });
  });

  it('rejects unsupported runtimes', () => {
    expect(() => createTangemAdapter({
      kind: 'real-device',
      transport: 'webhid',
    })).toThrow(UnsupportedOperationError);
  });

  it('requires an injected React Native SDK before connecting', async () => {
    const adapter = createTangemAdapter({
      kind: 'tangem-react-native-nfc',
      transport: 'nfc',
    });

    await expect(adapter.connect()).rejects.toThrow(AdapterInitializationError);
  });

  it('connects through an injected Tangem SDK and returns the scanned Solana account', async () => {
    const sdk: TangemReactNativeSdk = {
      startSession: vi.fn(),
      scanCard: vi.fn().mockResolvedValue({
        cardId: 'card-1',
        wallets: [{
          curve: 'ed25519',
          derivationPath: TANGEM_SOLANA_DERIVATION_PATH,
          publicKey: publicKeyHex,
        }],
      }),
      stopSession: vi.fn(),
      sign: vi.fn().mockResolvedValue({
        signatures: [signatureHex],
      }),
    };

    const adapter = createTangemAdapter({
      kind: 'tangem-react-native-nfc',
      transport: 'nfc',
      sdk,
    });

    const connection = await adapter.connect();
    const [account] = await adapter.getAccounts({ startIndex: 0, count: 1 });

    expect(connection.walletId).toBe('tangem');
    expect(account).toMatchObject({
      index: 0,
      path: TANGEM_SOLANA_DERIVATION_PATH,
      address: publicKeyAddress,
    });
    expect(sdk.startSession).toHaveBeenCalledWith({
      attestationMode: 'offline',
      defaultDerivationPaths: TANGEM_SOLANA_DERIVATION_PATH,
    });
  });

  it('uses legacy Solana message bytes for transaction signing', async () => {
    const sdk: TangemReactNativeSdk = {
      scanCard: vi.fn().mockResolvedValue({
        cardId: 'card-1',
        wallets: [{
          derivationPath: TANGEM_SOLANA_DERIVATION_PATH,
          publicKey: publicKeyHex,
        }],
      }),
      sign: vi.fn().mockResolvedValue({
        signatures: [signatureHex],
      }),
    };
    const adapter = createTangemAdapter({
      kind: 'tangem-react-native-nfc',
      transport: 'nfc',
      sdk,
    });
    await adapter.connect();

    const transaction = createPlaygroundTransaction({
      fromAddress: publicKeyAddress,
    });

    await adapter.signTransaction({
      derivationPath: TANGEM_SOLANA_DERIVATION_PATH,
      transaction,
      signingPayloadMode: 'legacy-message-bytes',
    });

    expect(sdk.sign).toHaveBeenCalledWith({
      cardId: 'card-1',
      hashes: [bytesToHex(Uint8Array.from(transaction.serializeMessage()))],
    });
  });

  it('rejects serialized transaction mode because Tangem signs message bytes', async () => {
    const sdk: TangemReactNativeSdk = {
      scanCard: vi.fn().mockResolvedValue({
        cardId: 'card-1',
        wallets: [{
          publicKey: publicKeyHex,
        }],
      }),
    };
    const adapter = createTangemAdapter({
      kind: 'tangem-react-native-nfc',
      transport: 'nfc',
      sdk,
    });
    await adapter.connect();

    await expect(adapter.signTransaction({
      transaction: createPlaygroundTransaction({
        fromAddress: publicKeyAddress,
      }),
      signingPayloadMode: 'serialized-transaction',
    })).rejects.toThrow(UnsupportedOperationError);
  });
});

describe('Tangem helpers', () => {
  it('normalizes a Tangem hex public key into a Solana address', () => {
    expect(normalizeTangemSolanaPublicKey(publicKeyHex)).toBe(publicKeyAddress);
  });

  it('extracts a card session from nested scan payloads', () => {
    expect(extractTangemCardSession({
      result: {
        cardId: 'card-1',
        derivedKeys: {
          [TANGEM_SOLANA_DERIVATION_PATH]: publicKeyHex,
        },
      },
    }, TANGEM_SOLANA_DERIVATION_PATH)).toEqual({
      cardId: 'card-1',
      address: publicKeyAddress,
      derivationPath: TANGEM_SOLANA_DERIVATION_PATH,
    });
  });

  it('extracts a 64-byte signature from common Tangem response shapes', () => {
    expect(extractTangemSignature({
      signatures: [signatureHex],
    })).toEqual(Uint8Array.from(Array.from({ length: 64 }, (_, index) => index + 1)));
  });
});
