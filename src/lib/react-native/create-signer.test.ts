import { PublicKey } from '@solana/web3.js';
import { describe, expect, it, vi } from 'vitest';

import { UnsupportedOperationError } from '@/lib/hwsigner/errors';
import { createReactNativeHWSigner } from '@/lib/react-native/create-signer';
import { getReactNativeWalletSupport, reactNativeWalletSupport } from '@/lib/react-native/support';

const reactNativePublicKey = new PublicKey(Uint8Array.from(Array.from({ length: 32 }, (_, index) => index + 1)));

describe('createReactNativeHWSigner', () => {
  it('creates the Tangem React Native NFC adapter without importing web wallet adapters', () => {
    const signer = createReactNativeHWSigner({
      walletId: 'tangem',
      runtime: {
        kind: 'tangem-react-native-nfc',
        transport: 'nfc',
      },
    });

    expect(signer.getCapabilities()).toMatchObject({
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

  it('rejects Tangem web WalletConnect runtime in the React Native entrypoint', () => {
    expect(() => createReactNativeHWSigner({
      walletId: 'tangem',
      runtime: {
        kind: 'tangem-walletconnect',
        transport: 'qr',
      },
    })).toThrow(UnsupportedOperationError);
  });

  it('rejects wallets that do not have a React Native runtime yet', () => {
    expect(() => createReactNativeHWSigner({
      walletId: 'ledger',
      runtime: {
        kind: 'real-device',
        transport: 'webhid',
      },
    })).toThrow(/not implemented in the React Native entrypoint yet/);
  });

  it('creates a React Native WalletConnect adapter around an injected Solana wallet client', async () => {
    const wallet = {
      publicKey: reactNativePublicKey,
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      signMessage: vi.fn().mockResolvedValue(Uint8Array.from(Array.from({ length: 64 }, (_, index) => index + 1))),
    };

    const signer = createReactNativeHWSigner({
      walletId: 'dcent',
      runtime: {
        kind: 'react-native-walletconnect',
        transport: 'deep-link',
        wallet,
        walletName: "D'CENT",
        capabilities: {
          nfc: true,
          signTransaction: false,
          signVersionedTransaction: false,
        },
      },
    });

    expect(signer.getCapabilities()).toMatchObject({
      connect: true,
      disconnect: true,
      getAccounts: true,
      signMessage: true,
      signTransaction: false,
      signVersionedTransaction: false,
      qr: true,
      nfc: true,
    });

    await signer.connect();
    const accounts = await signer.getAccounts({ startIndex: 0, count: 2 });

    expect(wallet.connect).toHaveBeenCalledOnce();
    expect(accounts).toEqual([{
      index: 0,
      path: 'dcent://react-native-walletconnect-selected-account',
      address: reactNativePublicKey.toBase58(),
    }]);
  });

  it('creates a React Native Keystone QR adapter around an injected native QR client', async () => {
    const wallet = {
      publicKey: reactNativePublicKey,
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      signMessage: vi.fn().mockResolvedValue(Uint8Array.from(Array.from({ length: 64 }, (_, index) => index + 1))),
    };

    const signer = createReactNativeHWSigner({
      walletId: 'keystone',
      runtime: {
        kind: 'react-native-keystone-qr',
        transport: 'qr',
        wallet,
      },
    });

    expect(signer.getCapabilities()).toMatchObject({
      connect: true,
      disconnect: true,
      getAccounts: true,
      signMessage: true,
      signTransaction: false,
      signVersionedTransaction: false,
      qr: true,
      nfc: false,
    });

    await signer.connect();
    const accounts = await signer.getAccounts({ startIndex: 0, count: 1 });

    expect(wallet.connect).toHaveBeenCalledOnce();
    expect(accounts).toEqual([{
      index: 0,
      path: 'keystone://react-native-qr-selected-account',
      address: reactNativePublicKey.toBase58(),
    }]);
  });

  it('rejects React Native Keystone QR runtime for non-Keystone wallets', () => {
    expect(() => createReactNativeHWSigner({
      walletId: 'dcent',
      runtime: {
        kind: 'react-native-keystone-qr',
        transport: 'qr',
        wallet: {
          publicKey: reactNativePublicKey,
          connect: vi.fn(),
        },
      },
    })).toThrow(/only supports Keystone/);
  });

  it('rejects React Native WalletConnect for wallets without a mapped native runtime', () => {
    expect(() => createReactNativeHWSigner({
      walletId: 'keypal',
      runtime: {
        kind: 'react-native-walletconnect',
        transport: 'qr',
        wallet: {
          publicKey: reactNativePublicKey,
          connect: vi.fn(),
        },
      },
    })).toThrow(/does not have a React Native WalletConnect runtime mapped yet/);
  });
});

describe('React Native wallet support manifest', () => {
  it('marks Tangem as implemented', () => {
    const support = getReactNativeWalletSupport('tangem');

    expect(support).toMatchObject({
      walletId: 'tangem',
      status: 'implemented',
    });
    expect(support.runtimes).toEqual(['tangem-react-native-nfc', 'react-native-walletconnect']);
  });

  it('marks mobile WalletConnect hardware wallets as adapter-ready', () => {
    expect(getReactNativeWalletSupport('keystone')).toMatchObject({
      walletId: 'keystone',
      status: 'adapter-ready',
      runtimes: ['react-native-keystone-qr'],
    });
    expect(getReactNativeWalletSupport('dcent')).toMatchObject({
      walletId: 'dcent',
      status: 'adapter-ready',
      runtimes: ['react-native-walletconnect'],
    });
    expect(getReactNativeWalletSupport('bc-vault')).toMatchObject({
      walletId: 'bc-vault',
      status: 'adapter-ready',
      runtimes: ['react-native-walletconnect'],
    });
  });

  it('keeps web-only browser-provider wallets out of the React Native runtime', () => {
    expect(getReactNativeWalletSupport('gridplus-lattice')).toMatchObject({
      walletId: 'gridplus-lattice',
      status: 'web-only',
    });
    expect(getReactNativeWalletSupport('keypal')).toMatchObject({
      walletId: 'keypal',
      status: 'web-only',
    });
  });

  it('covers every current wallet id once', () => {
    const walletIds = reactNativeWalletSupport.map((wallet) => wallet.walletId);

    expect(new Set(walletIds).size).toBe(walletIds.length);
    expect(walletIds).toContain('ledger');
    expect(walletIds).toContain('bc-vault');
    expect(walletIds).toContain('ngrave');
  });
});
