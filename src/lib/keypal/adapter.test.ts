import { describe, expect, it } from 'vitest';

import { UnsupportedOperationError } from '@/lib/hwsigner/errors';
import { createKeyPalAdapter } from '@/lib/keypal/adapter';

describe('KeyPal adapter', () => {
  it('exposes the expected capability shape for the TokenPocket provider runtime', () => {
    const adapter = createKeyPalAdapter({
      kind: 'keypal-tokenpocket-provider',
      transport: 'injected-provider',
    });

    expect(adapter.getCapabilities()).toMatchObject({
      connect: true,
      disconnect: true,
      getAccounts: true,
      signMessage: true,
      signTransaction: true,
      signVersionedTransaction: false,
      usb: false,
      ble: false,
      qr: false,
      nfc: false,
    });
  });

  it('rejects unsupported runtimes', () => {
    expect(() => createKeyPalAdapter({
      kind: 'real-device',
      transport: 'webhid',
    })).toThrow(UnsupportedOperationError);
  });
});
