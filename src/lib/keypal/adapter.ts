import type {
  HWSignerEventListener,
  HWSignerRuntime,
  WalletAdapter,
} from '../hwsigner/types';
import { UnsupportedOperationError } from '../hwsigner/errors';
import { KeyPalTokenPocketClient } from './client';

export function createKeyPalAdapter(runtime: HWSignerRuntime, onEvent?: HWSignerEventListener): WalletAdapter {
  if (runtime.kind !== 'keypal-tokenpocket-provider') {
    throw new UnsupportedOperationError('KeyPal only supports the TokenPocket injected provider runtime in this project.');
  }

  return new KeyPalAdapter(onEvent);
}

class KeyPalAdapter implements WalletAdapter {
  private readonly client: KeyPalTokenPocketClient;

  constructor(onEvent?: HWSignerEventListener) {
    this.client = new KeyPalTokenPocketClient(onEvent);
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