import { describe, expect, it } from 'vitest';

import { buildWalletCodeExamples } from '@/data/code-examples';

describe('buildWalletCodeExamples', () => {
  it('uses native solana web3.js transactions for legacy signing examples', () => {
    const examples = buildWalletCodeExamples({
      walletId: 'ledger',
      walletName: 'Ledger',
      supportsSignMessage: true,
      runtime: { kind: 'real-device', transport: 'webhid' },
      derivationPath: "m/44'/501'/0'/0'",
      deriveCount: 3,
      message: 'hello',
      txVersion: 'legacy',
      txSigningPayloadMode: 'serialized-transaction',
      transactionRecipient: 'DRpbCBMxVnDK7maPMoGQfFiRLNGhFM1M7J9sX9g3BJ2j',
      transactionLamports: 1_500_000,
    });

    const snippet = examples.find((example) => example.id === 'sign-transaction');

    expect(snippet?.code).toContain("from '@solana/web3.js'");
    expect(snippet?.code).toContain('new Transaction({');
    expect(snippet?.code).toContain('signTransaction({');
    expect(snippet?.code).not.toContain('createPlaygroundTransaction');
  });

  it('uses native solana web3.js versioned transactions for v0 signing examples', () => {
    const examples = buildWalletCodeExamples({
      walletId: 'ledger',
      walletName: 'Ledger',
      supportsSignMessage: true,
      runtime: { kind: 'speculos', apiBaseUrl: 'http://127.0.0.1:5000' },
      derivationPath: "m/44'/501'/1'/0'",
      deriveCount: 2,
      message: 'hello',
      txVersion: 'v0',
      txSigningPayloadMode: 'versioned-message-bytes',
      transactionRecipient: 'DRpbCBMxVnDK7maPMoGQfFiRLNGhFM1M7J9sX9g3BJ2j',
      transactionLamports: 1_500_000,
    });

    const snippet = examples.find((example) => example.id === 'sign-transaction');

    expect(snippet?.code).toContain("from '@solana/web3.js'");
    expect(snippet?.code).toContain('new VersionedTransaction(messageV0);');
    expect(snippet?.code).toContain('compileToV0Message()');
    expect(snippet?.code).toContain("signingPayloadMode: 'versioned-message-bytes'");
    expect(snippet?.code).toContain('signVersionedTransaction({');
    expect(snippet?.code).not.toContain('createPlaygroundVersionedTransaction');
  });

  it('omits sign-message snippets for wallets without that capability', () => {
    const examples = buildWalletCodeExamples({
      walletId: 'trezor',
      walletName: 'Trezor',
      supportsSignMessage: false,
      runtime: { kind: 'trezor-connect', transport: 'popup-bridge' },
      derivationPath: "m/44'/501'/0'/0'",
      deriveCount: 1,
      message: 'hello',
      txVersion: 'legacy',
      txSigningPayloadMode: 'serialized-transaction',
      transactionRecipient: 'DRpbCBMxVnDK7maPMoGQfFiRLNGhFM1M7J9sX9g3BJ2j',
      transactionLamports: 1_500_000,
    });

    expect(examples.some((example) => example.id === 'sign-message')).toBe(false);
  });

  it('shows Tangem React Native SDK injection in setup examples', () => {
    const examples = buildWalletCodeExamples({
      walletId: 'tangem',
      walletName: 'Tangem',
      supportsSignMessage: true,
      runtime: {
        kind: 'tangem-react-native-nfc',
        transport: 'nfc',
        defaultDerivationPath: "m/44'/501'/0'/0'",
      },
      derivationPath: "m/44'/501'/0'/0'",
      deriveCount: 1,
      message: 'hello',
      txVersion: 'legacy',
      txSigningPayloadMode: 'legacy-message-bytes',
      transactionRecipient: 'DRpbCBMxVnDK7maPMoGQfFiRLNGhFM1M7J9sX9g3BJ2j',
      transactionLamports: 1_500_000,
    });

    const setup = examples.find((example) => example.id === 'setup');

    expect(setup?.code).toContain("import { createReactNativeHWSigner } from '@/lib/react-native';");
    expect(setup?.code).toContain("import RNTangemSdk from 'tangem-sdk-react-native';");
    expect(setup?.code).toContain('createReactNativeHWSigner({');
    expect(setup?.code).toContain('sdk: RNTangemSdk');
    expect(setup?.code).toContain("transport: 'nfc'");
    expect(setup?.code).not.toContain('createHWSigner({');
  });

  it('shows Tangem WalletConnect setup without React Native SDK injection', () => {
    const examples = buildWalletCodeExamples({
      walletId: 'tangem',
      walletName: 'Tangem',
      supportsSignMessage: true,
      runtime: {
        kind: 'tangem-walletconnect',
        transport: 'qr',
      },
      derivationPath: 'tangem://walletconnect-selected-account',
      deriveCount: 1,
      message: 'hello',
      txVersion: 'v0',
      txSigningPayloadMode: 'serialized-transaction',
      transactionRecipient: 'DRpbCBMxVnDK7maPMoGQfFiRLNGhFM1M7J9sX9g3BJ2j',
      transactionLamports: 1_500_000,
    });

    const setup = examples.find((example) => example.id === 'setup');
    const signTransaction = examples.find((example) => example.id === 'sign-transaction');

    expect(setup?.code).toContain("kind: 'tangem-walletconnect'");
    expect(setup?.code).toContain("transport: 'qr'");
    expect(setup?.code).not.toContain('RNTangemSdk');
    expect(signTransaction?.code).toContain('new VersionedTransaction(messageV0);');
    expect(signTransaction?.code).toContain("signingPayloadMode: 'serialized-transaction'");
  });

  it('shows Solflare Shield SDK runtime examples without pretending to access the card directly', () => {
    const examples = buildWalletCodeExamples({
      walletId: 'solflare-shield',
      walletName: 'Solflare Shield',
      supportsSignMessage: true,
      runtime: {
        kind: 'solflare-shield-sdk',
        transport: 'nfc',
        network: 'devnet',
      },
      derivationPath: 'solflare-shield://selected-account',
      deriveCount: 1,
      message: 'hello',
      txVersion: 'v0',
      txSigningPayloadMode: 'serialized-transaction',
      transactionRecipient: 'DRpbCBMxVnDK7maPMoGQfFiRLNGhFM1M7J9sX9g3BJ2j',
      transactionLamports: 1_500_000,
    });

    const setup = examples.find((example) => example.id === 'setup');
    const signTransaction = examples.find((example) => example.id === 'sign-transaction');

    expect(setup?.code).toContain("kind: 'solflare-shield-sdk'");
    expect(setup?.code).toContain("network: 'devnet'");
    expect(signTransaction?.code).toContain('new VersionedTransaction(messageV0);');
    expect(signTransaction?.code).toContain("signingPayloadMode: 'serialized-transaction'");
  });

  it('shows GridPlus Lattice1 through the NuFi provider runtime', () => {
    const examples = buildWalletCodeExamples({
      walletId: 'gridplus-lattice',
      walletName: 'GridPlus Lattice1',
      supportsSignMessage: true,
      runtime: {
        kind: 'gridplus-nufi-provider',
        transport: 'injected-provider',
      },
      derivationPath: 'gridplus-lattice://nufi-selected-account',
      deriveCount: 1,
      message: 'hello',
      txVersion: 'legacy',
      txSigningPayloadMode: 'serialized-transaction',
      transactionRecipient: 'DRpbCBMxVnDK7maPMoGQfFiRLNGhFM1M7J9sX9g3BJ2j',
      transactionLamports: 1_500_000,
    });

    const setup = examples.find((example) => example.id === 'setup');
    const signTransaction = examples.find((example) => example.id === 'sign-transaction');

    expect(setup?.code).toContain("kind: 'gridplus-nufi-provider'");
    expect(setup?.code).toContain("transport: 'injected-provider'");
    expect(signTransaction?.code).toContain('new Transaction({');
    expect(signTransaction?.code).toContain("signingPayloadMode: 'serialized-transaction'");
  });

  it('shows Arculus through the WalletConnect runtime', () => {
    const examples = buildWalletCodeExamples({
      walletId: 'arculus',
      walletName: 'Arculus',
      supportsSignMessage: true,
      runtime: {
        kind: 'arculus-walletconnect',
        transport: 'qr',
      },
      derivationPath: 'arculus://selected-account',
      deriveCount: 1,
      message: 'hello',
      txVersion: 'v0',
      txSigningPayloadMode: 'serialized-transaction',
      transactionRecipient: 'DRpbCBMxVnDK7maPMoGQfFiRLNGhFM1M7J9sX9g3BJ2j',
      transactionLamports: 1_500_000,
    });

    const setup = examples.find((example) => example.id === 'setup');
    const signTransaction = examples.find((example) => example.id === 'sign-transaction');

    expect(setup?.code).toContain("kind: 'arculus-walletconnect'");
    expect(setup?.code).toContain("transport: 'qr'");
    expect(signTransaction?.code).toContain('new VersionedTransaction(messageV0);');
    expect(signTransaction?.code).toContain("signingPayloadMode: 'serialized-transaction'");
  });

  it('shows KeyPal through the TokenPocket provider runtime', () => {
    const examples = buildWalletCodeExamples({
      walletId: 'keypal',
      walletName: 'KeyPal',
      supportsSignMessage: true,
      runtime: {
        kind: 'keypal-tokenpocket-provider',
        transport: 'injected-provider',
      },
      derivationPath: 'keypal://tokenpocket-selected-account',
      deriveCount: 1,
      message: 'hello',
      txVersion: 'legacy',
      txSigningPayloadMode: 'serialized-transaction',
      transactionRecipient: 'DRpbCBMxVnDK7maPMoGQfFiRLNGhFM1M7J9sX9g3BJ2j',
      transactionLamports: 1_500_000,
    });

    const setup = examples.find((example) => example.id === 'setup');
    const signTransaction = examples.find((example) => example.id === 'sign-transaction');

    expect(setup?.code).toContain("kind: 'keypal-tokenpocket-provider'");
    expect(setup?.code).toContain("transport: 'injected-provider'");
    expect(signTransaction?.code).toContain('new Transaction({');
    expect(signTransaction?.code).toContain("signingPayloadMode: 'serialized-transaction'");
  });

  it('shows BC Vault through the WalletConnect runtime', () => {
    const examples = buildWalletCodeExamples({
      walletId: 'bc-vault',
      walletName: 'BC Vault',
      supportsSignMessage: true,
      runtime: {
        kind: 'bc-vault-walletconnect',
        transport: 'qr',
      },
      derivationPath: 'bc-vault://selected-account',
      deriveCount: 1,
      message: 'hello',
      txVersion: 'v0',
      txSigningPayloadMode: 'serialized-transaction',
      transactionRecipient: 'DRpbCBMxVnDK7maPMoGQfFiRLNGhFM1M7J9sX9g3BJ2j',
      transactionLamports: 1_500_000,
    });

    const setup = examples.find((example) => example.id === 'setup');
    const signTransaction = examples.find((example) => example.id === 'sign-transaction');

    expect(setup?.code).toContain("kind: 'bc-vault-walletconnect'");
    expect(setup?.code).toContain("transport: 'qr'");
    expect(signTransaction?.code).toContain('new VersionedTransaction(messageV0);');
    expect(signTransaction?.code).toContain("signingPayloadMode: 'serialized-transaction'");
  });

  it('shows the React Native entrypoint for injected WalletConnect wallet clients', () => {
    const examples = buildWalletCodeExamples({
      walletId: 'dcent',
      walletName: "D'CENT",
      supportsSignMessage: true,
      runtime: {
        kind: 'react-native-walletconnect',
        transport: 'deep-link',
        walletName: "D'CENT",
        wallet: {
          publicKey: '11111111111111111111111111111111',
          connect: async () => undefined,
        },
      },
      derivationPath: 'dcent://react-native-walletconnect-selected-account',
      deriveCount: 1,
      message: 'hello',
      txVersion: 'legacy',
      txSigningPayloadMode: 'serialized-transaction',
      transactionRecipient: 'DRpbCBMxVnDK7maPMoGQfFiRLNGhFM1M7J9sX9g3BJ2j',
      transactionLamports: 1_500_000,
    });

    const setup = examples.find((example) => example.id === 'setup');

    expect(setup?.code).toContain("from '@/lib/react-native'");
    expect(setup?.code).toContain('createReactNativeHWSigner({');
    expect(setup?.code).toContain('declare const wallet: ReactNativeSolanaWalletClient;');
    expect(setup?.code).toContain("kind: 'react-native-walletconnect'");
    expect(setup?.code).toContain("transport: 'deep-link'");
    expect(setup?.code).not.toContain('createHWSigner({');
  });

  it('shows the React Native entrypoint for injected Keystone QR clients', () => {
    const examples = buildWalletCodeExamples({
      walletId: 'keystone',
      walletName: 'Keystone',
      supportsSignMessage: true,
      runtime: {
        kind: 'react-native-keystone-qr',
        transport: 'qr',
        wallet: {
          publicKey: '11111111111111111111111111111111',
          connect: async () => undefined,
        },
      },
      derivationPath: 'keystone://react-native-qr-selected-account',
      deriveCount: 1,
      message: 'hello',
      txVersion: 'v0',
      txSigningPayloadMode: 'serialized-transaction',
      transactionRecipient: 'DRpbCBMxVnDK7maPMoGQfFiRLNGhFM1M7J9sX9g3BJ2j',
      transactionLamports: 1_500_000,
    });

    const setup = examples.find((example) => example.id === 'setup');

    expect(setup?.code).toContain("from '@/lib/react-native'");
    expect(setup?.code).toContain('createReactNativeHWSigner({');
    expect(setup?.code).toContain('React Native Keystone QR scanner / UR flow');
    expect(setup?.code).toContain("kind: 'react-native-keystone-qr'");
    expect(setup?.code).toContain("transport: 'qr'");
  });
});
