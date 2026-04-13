import { UnsupportedOperationError } from '../hwsigner/errors';
import type {
  HWSignerEventListener,
  HWSignerRuntime,
  WalletAdapter,
} from '../hwsigner/types';
import { TangemReactNativeNfcClient } from './client';

export function createTangemReactNativeAdapter(runtime: HWSignerRuntime, onEvent?: HWSignerEventListener): WalletAdapter {
  if (runtime.kind !== 'tangem-react-native-nfc') {
    throw new UnsupportedOperationError('Tangem React Native only supports the native NFC runtime.');
  }

  return new TangemReactNativeAdapter(runtime, onEvent);
}

class TangemReactNativeAdapter implements WalletAdapter {
  private readonly client: TangemReactNativeNfcClient;

  constructor(runtime: Extract<HWSignerRuntime, { kind: 'tangem-react-native-nfc' }>, onEvent?: HWSignerEventListener) {
    this.client = new TangemReactNativeNfcClient({
      sdk: runtime.sdk,
      defaultDerivationPath: runtime.defaultDerivationPath,
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