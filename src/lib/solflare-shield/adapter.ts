import type {
  HWSignerEventListener,
  HWSignerRuntime,
  WalletAdapter,
} from '../hwsigner/types';
import { UnsupportedOperationError } from '../hwsigner/errors';
import { SolflareShieldClient } from './client';

export function createSolflareShieldAdapter(runtime: HWSignerRuntime, onEvent?: HWSignerEventListener): WalletAdapter {
  if (runtime.kind !== 'solflare-shield-sdk') {
    throw new UnsupportedOperationError('Solflare Shield only supports the Solflare Wallet SDK runtime in this project.');
  }

  return new SolflareShieldAdapter(runtime, onEvent);
}

class SolflareShieldAdapter implements WalletAdapter {
  private readonly client: SolflareShieldClient;

  constructor(runtime: Extract<HWSignerRuntime, { kind: 'solflare-shield-sdk' }>, onEvent?: HWSignerEventListener) {
    this.client = new SolflareShieldClient({
      network: runtime.network,
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