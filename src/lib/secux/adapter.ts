import type {
  HWSignerEventListener,
  HWSignerRuntime,
  WalletAdapter,
} from '@/lib/hwsigner/types';
import { UnsupportedOperationError } from '@/lib/hwsigner/errors';
import { SecuXWebUsbClient } from '@/lib/secux/client';

export function createSecuXAdapter(runtime: HWSignerRuntime, onEvent?: HWSignerEventListener): WalletAdapter {
  if (runtime.kind !== 'secux-webusb') {
    throw new UnsupportedOperationError('SecuX only supports the WebUSB runtime in this project.');
  }

  return new SecuXAdapter(onEvent);
}

class SecuXAdapter implements WalletAdapter {
  private readonly client: SecuXWebUsbClient;

  constructor(onEvent?: HWSignerEventListener) {
    this.client = new SecuXWebUsbClient(onEvent);
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
