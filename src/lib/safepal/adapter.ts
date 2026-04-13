import type {
  HWSignerEventListener,
  HWSignerRuntime,
  WalletAdapter,
} from '../hwsigner/types';
import { UnsupportedOperationError } from '../hwsigner/errors';
import { SafePalProviderClient } from './client';

export function createSafePalAdapter(runtime: HWSignerRuntime, onEvent?: HWSignerEventListener): WalletAdapter {
  if (runtime.kind !== 'safepal-provider') {
    throw new UnsupportedOperationError('SafePal only supports the injected provider runtime in this project.');
  }

  return new SafePalAdapter(onEvent);
}

class SafePalAdapter implements WalletAdapter {
  private readonly client: SafePalProviderClient;

  constructor(onEvent?: HWSignerEventListener) {
    this.client = new SafePalProviderClient(onEvent);
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