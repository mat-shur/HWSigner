import { describe, expect, it } from 'vitest';

import { UnsupportedOperationError } from '../hwsigner/errors';
import { createSolflareShieldAdapter } from './adapter';
import { getSolflareShieldErrorMessage, mapSolflareShieldError } from './error-map';

describe('Solflare Shield adapter', () => {
  it('exposes the expected capability shape for the Solflare SDK runtime', () => {
    const adapter = createSolflareShieldAdapter({
      kind: 'solflare-shield-sdk',
      transport: 'nfc',
      network: 'devnet',
    });

    expect(adapter.getCapabilities()).toMatchObject({
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

  it('rejects unsupported runtimes', () => {
    expect(() => createSolflareShieldAdapter({
      kind: 'real-device',
      transport: 'webhid',
    })).toThrow(UnsupportedOperationError);
  });
});

describe('Solflare Shield errors', () => {
  it('extracts nested SDK error messages', () => {
    expect(getSolflareShieldErrorMessage({
      error: {
        message: 'User rejected request',
      },
    })).toBe('User rejected request');
  });

  it('maps rejected prompts to normalized user rejection errors', () => {
    expect(mapSolflareShieldError(new Error('User rejected request')).code).toBe('USER_REJECTED');
  });
});