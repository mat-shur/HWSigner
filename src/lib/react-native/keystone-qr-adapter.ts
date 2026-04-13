import { UnsupportedOperationError } from '../hwsigner/errors';
import type {
  HWSignerEventListener,
  HWSignerRuntime,
  HWWalletId,
  WalletAdapter,
} from '../hwsigner/types';
import { ReactNativeInjectedSolanaClient } from './walletconnect-client';

export function createReactNativeKeystoneQrAdapter(
  walletId: HWWalletId,
  runtime: HWSignerRuntime,
  onEvent?: HWSignerEventListener,
): WalletAdapter {
  if (walletId !== 'keystone') {
    throw new UnsupportedOperationError('React Native Keystone QR runtime only supports Keystone.');
  }

  if (runtime.kind !== 'react-native-keystone-qr') {
    throw new UnsupportedOperationError('Keystone React Native QR requires the react-native-keystone-qr runtime.');
  }

  return new ReactNativeKeystoneQrAdapter(runtime, onEvent);
}

class ReactNativeKeystoneQrAdapter implements WalletAdapter {
  private readonly client: ReactNativeInjectedSolanaClient;

  constructor(
    runtime: Extract<HWSignerRuntime, { kind: 'react-native-keystone-qr' }>,
    onEvent?: HWSignerEventListener,
  ) {
    this.client = new ReactNativeInjectedSolanaClient({
      walletId: 'keystone',
      runtime,
      onEvent,
    });
  }

  connect() {
    return this.client.connect();
  }

  disconnect() {
    return this.client.disconnect();
  }

  getCapabilities() {
    return this.client.getCapabilities();
  }

  getAppConfiguration() {
    return this.client.getAppConfiguration();
  }

  getAccounts(input: Parameters<WalletAdapter['getAccounts']>[0]) {
    return this.client.getAccounts(input);
  }

  signMessage(input: Parameters<WalletAdapter['signMessage']>[0]) {
    return this.client.signMessage(input);
  }

  signTransaction(input: Parameters<WalletAdapter['signTransaction']>[0]) {
    return this.client.signTransaction(input);
  }

  signVersionedTransaction(input: Parameters<WalletAdapter['signVersionedTransaction']>[0]) {
    return this.client.signVersionedTransaction(input);
  }
}