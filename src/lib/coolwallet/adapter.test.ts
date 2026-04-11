import { describe, expect, it } from 'vitest';

import { UnsupportedOperationError } from '@/lib/hwsigner/errors';
import { createCoolWalletAdapter } from '@/lib/coolwallet/adapter';

describe('CoolWallet adapter', () => {
  it('exposes the expected capability shape for web-ble', () => {
    const adapter = createCoolWalletAdapter({
      kind: 'coolwallet-web-ble',
      transport: 'web-ble',
    });

    expect(adapter.getCapabilities()).toMatchObject({
      connect: true,
      disconnect: true,
      getAccounts: true,
      signMessage: true,
      signTransaction: true,
      signVersionedTransaction: true,
      usb: false,
      ble: true,
      qr: false,
      nfc: false,
    });
  });

  it('rejects unsupported runtimes', () => {
    expect(() => createCoolWalletAdapter({
      kind: 'real-device',
      transport: 'webhid',
    })).toThrow(UnsupportedOperationError);
  });
});
