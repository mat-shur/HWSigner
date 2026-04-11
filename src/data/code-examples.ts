import type { HWSignerRuntime, TransactionSigningPayloadMode } from '@/lib/hwsigner/types';

export type CodeExample = {
  id: string;
  title: string;
  description: string;
  code: string;
};

export function buildWalletCodeExamples(params: {
  walletId: string;
  walletName: string;
  supportsSignMessage: boolean;
  runtime: HWSignerRuntime | null;
  derivationPath: string;
  deriveCount: number;
  message: string;
  txVersion: 'legacy' | 'v0';
  txSigningPayloadMode: TransactionSigningPayloadMode;
  transactionRecipient: string;
  transactionLamports: number;
}): CodeExample[] {
  const runtimeLiteral = getRuntimeLiteral(params.runtime);
  const createSignerImports = getCreateSignerImports(params.runtime);
  const createSignerFunction = getCreateSignerFunction(params.runtime);
  const setupPrelude = getSetupPrelude(params.runtime);
  const derivationPathLiteral = JSON.stringify(params.derivationPath);
  const messageLiteral = JSON.stringify(params.message);
  const recipientLiteral = JSON.stringify(params.transactionRecipient);
  const startIndex = extractIndex(params.derivationPath);

  const transactionMethod = params.txVersion === 'v0'
    ? 'signVersionedTransaction'
    : 'signTransaction';

  const examples: CodeExample[] = [
    {
      id: 'setup',
      title: 'Create Signer',
      description: `Boot the implemented ${params.walletName} adapter with the currently selected runtime.`,
      code: [
        ...createSignerImports,
        '',
        ...setupPrelude,
        `const signer = ${createSignerFunction}({`,
        `  walletId: '${params.walletId}',`,
        `  runtime: ${runtimeLiteral},`,
        '});',
        '',
        'const connection = await signer.connect();',
        'console.log(connection.appConfiguration);',
      ].join('\n'),
    },
    {
      id: 'capabilities',
      title: 'Read Capabilities',
      description: 'Inspect what the selected runtime says it supports right now.',
      code: [
        ...createSignerImports,
        '',
        ...setupPrelude,
        `const signer = ${createSignerFunction}({`,
        `  walletId: '${params.walletId}',`,
        `  runtime: ${runtimeLiteral},`,
        '});',
        '',
        'const capabilities = signer.getCapabilities();',
        'console.log(capabilities);',
      ].join('\n'),
    },
    {
      id: 'derive',
      title: 'Derive Accounts',
      description: `Derive one or more ${params.walletName} accounts using the current derivation index window.`,
      code: [
        'const accounts = await signer.getAccounts({',
        `  startIndex: ${extractIndex(params.derivationPath)},`,
        `  count: ${params.deriveCount},`,
        '});',
        '',
        'console.log(accounts.map((account) => ({',
        '  index: account.index,',
        '  path: account.path,',
        '  address: account.address,',
        '})));',
      ].join('\n'),
    },
  ];

  if (params.supportsSignMessage) {
    examples.push({
      id: 'sign-message',
      title: 'Sign Message',
      description: `Sign an off-chain message with the currently selected ${params.walletName} account.`,
      code: [
        'const messageResult = await signer.signMessage({',
        `  derivationPath: ${derivationPathLiteral},`,
        `  message: ${messageLiteral},`,
        '});',
        '',
        'console.log(messageResult.signature);',
      ].join('\n'),
    });
  }

  examples.push({
    id: 'sign-transaction',
    title: params.txVersion === 'v0' ? 'Sign Versioned Transaction' : 'Sign Legacy Transaction',
    description: `Pass a native @solana/web3.js ${params.txVersion === 'v0' ? 'VersionedTransaction' : 'Transaction'} into ${transactionMethod} using ${params.txSigningPayloadMode}.`,
    code: buildTransactionSnippet({
      txVersion: params.txVersion,
      txSigningPayloadMode: params.txSigningPayloadMode,
      startIndex,
      transactionRecipient: recipientLiteral,
      transactionLamports: params.transactionLamports,
      transactionMethod,
      derivationPathLiteral,
    }),
  });

  return examples;
}

export const buildLedgerCodeExamples = buildWalletCodeExamples;

function getCreateSignerImports(runtime: HWSignerRuntime | null): string[] {
  if (runtime?.kind === 'tangem-react-native-nfc') {
    return [
      "import { createReactNativeHWSigner } from '@/lib/react-native';",
      "import RNTangemSdk from 'tangem-sdk-react-native';",
    ];
  }

  if (runtime?.kind === 'react-native-walletconnect' || runtime?.kind === 'react-native-keystone-qr') {
    return ["import { createReactNativeHWSigner, type ReactNativeSolanaWalletClient } from '@/lib/react-native';"];
  }

  return ["import { createHWSigner } from '@/lib/hwsigner/create-signer';"];
}

function getCreateSignerFunction(runtime: HWSignerRuntime | null): string {
  return runtime?.kind === 'tangem-react-native-nfc'
    || runtime?.kind === 'react-native-walletconnect'
    || runtime?.kind === 'react-native-keystone-qr'
    ? 'createReactNativeHWSigner'
    : 'createHWSigner';
}

function getSetupPrelude(runtime: HWSignerRuntime | null): string[] {
  if (runtime?.kind !== 'react-native-walletconnect' && runtime?.kind !== 'react-native-keystone-qr') {
    return [];
  }

  if (runtime.kind === 'react-native-keystone-qr') {
    return [
      '// Provide this from your React Native Keystone QR scanner / UR flow.',
      'declare const wallet: ReactNativeSolanaWalletClient;',
      '',
    ];
  }

  return [
    '// Provide this from your React Native WalletConnect session layer.',
    'declare const wallet: ReactNativeSolanaWalletClient;',
    '',
  ];
}

function getRuntimeLiteral(runtime: HWSignerRuntime | null): string {
  if (!runtime) {
    return `{
  kind: 'real-device',
  transport: 'webhid',
}`;
  }

  if (runtime.kind === 'speculos') {
    return `{
  kind: 'speculos',
  apiBaseUrl: '${runtime.apiBaseUrl}',
}`;
  }

  if (runtime.kind === 'onekey-webusb') {
    return `{
  kind: 'onekey-webusb',
  transport: 'webusb',
}`;
  }

  if (runtime.kind === 'dcent-walletconnect') {
    return `{
  kind: 'dcent-walletconnect',
  transport: 'qr',
}`;
  }

  if (runtime.kind === 'ellipal-walletconnect') {
    return `{
  kind: 'ellipal-walletconnect',
  transport: 'qr',
}`;
  }

  if (runtime.kind === 'tangem-react-native-nfc') {
    return `{
  kind: 'tangem-react-native-nfc',
  transport: 'nfc',
  sdk: RNTangemSdk,
  defaultDerivationPath: '${runtime.defaultDerivationPath ?? "m/44'/501'/0'/0'"}',
}`;
  }

  if (runtime.kind === 'tangem-walletconnect') {
    return `{
  kind: 'tangem-walletconnect',
  transport: 'qr',
}`;
  }

  if (runtime.kind === 'solflare-shield-sdk') {
    return `{
  kind: 'solflare-shield-sdk',
  transport: 'nfc',
  network: '${runtime.network ?? 'devnet'}',
}`;
  }

  if (runtime.kind === 'gridplus-nufi-provider') {
    return `{
  kind: 'gridplus-nufi-provider',
  transport: 'injected-provider',
}`;
  }

  if (runtime.kind === 'arculus-walletconnect') {
    return `{
  kind: 'arculus-walletconnect',
  transport: 'qr',
}`;
  }

  if (runtime.kind === 'keypal-tokenpocket-provider') {
    return `{
  kind: 'keypal-tokenpocket-provider',
  transport: 'injected-provider',
}`;
  }

  if (runtime.kind === 'bc-vault-walletconnect') {
    return `{
  kind: 'bc-vault-walletconnect',
  transport: 'qr',
}`;
  }

  if (runtime.kind === 'react-native-walletconnect') {
    return `{
  kind: 'react-native-walletconnect',
  transport: '${runtime.transport}',
  wallet,
  walletName: ${JSON.stringify(runtime.walletName ?? 'Mobile hardware wallet')},
}`;
  }

  if (runtime.kind === 'react-native-keystone-qr') {
    return `{
  kind: 'react-native-keystone-qr',
  transport: 'qr',
  wallet,
  walletName: ${JSON.stringify(runtime.walletName ?? 'Keystone')},
}`;
  }

  if (runtime.kind === 'secux-webusb') {
    return `{
  kind: 'secux-webusb',
  transport: 'webusb',
}`;
  }

  if (runtime.kind === 'safepal-provider') {
    return `{
  kind: 'safepal-provider',
  transport: 'injected-provider',
}`;
  }

  if (runtime.kind === 'coolwallet-web-ble') {
    return `{
  kind: 'coolwallet-web-ble',
  transport: 'web-ble',
}`;
  }

  if (runtime.kind === 'cypherock-webusb') {
    return `{
  kind: 'cypherock-webusb',
  transport: 'webusb',
}`;
  }

  if (runtime.kind === 'keystone-qr') {
    return `{
  kind: 'keystone-qr',
  transport: 'qr',
}`;
  }

  if (runtime.kind === 'trezor-connect') {
    return `{
  kind: 'trezor-connect',
  transport: 'popup-bridge',
}`;
  }

  return `{
  kind: 'real-device',
  transport: '${runtime.transport}',
}`;
}

function extractIndex(derivationPath: string): number {
  const match = derivationPath.match(/m\/44'\/501'\/(\d+)'\/0'/);
  return match ? Number(match[1]) : 0;
}

function buildTransactionSnippet(params: {
  txVersion: 'legacy' | 'v0';
  txSigningPayloadMode: TransactionSigningPayloadMode;
  startIndex: number;
  transactionRecipient: string;
  transactionLamports: number;
  transactionMethod: 'signTransaction' | 'signVersionedTransaction';
  derivationPathLiteral: string;
}): string {
  if (params.txVersion === 'v0') {
    return [
      "import {",
      "  Connection,",
      "  PublicKey,",
      "  SystemProgram,",
      "  TransactionMessage,",
      "  VersionedTransaction,",
      "} from '@solana/web3.js';",
      '',
      `const [account] = await signer.getAccounts({ startIndex: ${params.startIndex}, count: 1 });`,
      "const connection = new Connection('https://api.devnet.solana.com', 'confirmed');",
      'const { blockhash } = await connection.getLatestBlockhash();',
      '',
      'const payer = new PublicKey(account.address);',
      `const recipient = new PublicKey(${params.transactionRecipient});`,
      '',
      'const messageV0 = new TransactionMessage({',
      '  payerKey: payer,',
      '  recentBlockhash: blockhash,',
      '  instructions: [',
      '    SystemProgram.transfer({',
      '      fromPubkey: payer,',
      '      toPubkey: recipient,',
      `      lamports: ${params.transactionLamports},`,
      '    }),',
      '  ],',
      '}).compileToV0Message();',
      '',
      'const transaction = new VersionedTransaction(messageV0);',
      '',
      `const signed = await signer.${params.transactionMethod}({`,
      '  derivationPath: account.path,',
      '  transaction,',
      `  signingPayloadMode: '${params.txSigningPayloadMode}',`,
      '});',
      '',
      'console.log(signed.signature);',
    ].join('\n');
  }

  return [
    "import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';",
    '',
    `const [account] = await signer.getAccounts({ startIndex: ${params.startIndex}, count: 1 });`,
    "const connection = new Connection('https://api.devnet.solana.com', 'confirmed');",
    'const { blockhash } = await connection.getLatestBlockhash();',
    '',
    'const transaction = new Transaction({',
    '  feePayer: new PublicKey(account.address),',
    '  recentBlockhash: blockhash,',
    '}).add(',
    '  SystemProgram.transfer({',
    '    fromPubkey: new PublicKey(account.address),',
    `    toPubkey: new PublicKey(${params.transactionRecipient}),`,
    `    lamports: ${params.transactionLamports},`,
    '  }),',
    ');',
    '',
    `const signed = await signer.${params.transactionMethod}({`,
    `  derivationPath: ${params.derivationPathLiteral},`,
    '  transaction,',
    `  signingPayloadMode: '${params.txSigningPayloadMode}',`,
    '});',
    '',
    'console.log(signed.signature);',
  ].join('\n');
}
