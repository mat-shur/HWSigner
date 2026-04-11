import type {
  HWSignerEventListener,
  HWSignerRuntime,
  WalletAdapter,
} from '@/lib/hwsigner/types';
import { UnsupportedOperationError } from '@/lib/hwsigner/errors';
import { TrezorConnectClient } from '@/lib/trezor/client';

export function createTrezorAdapter(runtime: HWSignerRuntime, onEvent?: HWSignerEventListener): WalletAdapter {
  if (runtime.kind !== 'trezor-connect') {
    throw new UnsupportedOperationError('Trezor only supports the Trezor Connect runtime in this project.');
  }

  return new TrezorAdapter(onEvent);
}

class TrezorAdapter implements WalletAdapter {
  private readonly client: TrezorConnectClient;

  constructor(onEvent?: HWSignerEventListener) {
    this.client = new TrezorConnectClient(onEvent);
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
