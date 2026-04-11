import { describe, expect, it } from 'vitest';

import { UnsupportedOperationError } from '@/lib/hwsigner/errors';
import { createSecuXAdapter } from '@/lib/secux/adapter';

describe('SecuX adapter', () => {
  it('exposes the expected capability shape for webusb', () => {
    const adapter = createSecuXAdapter({
      kind: 'secux-webusb',
      transport: 'webusb',
    });

    expect(adapter.getCapabilities()).toMatchObject({
      connect: true,
      disconnect: true,
      getAccounts: true,
      signMessage: true,
      signTransaction: true,
      signVersionedTransaction: true,
      usb: true,
      ble: false,
      qr: false,
      nfc: false,
    });
  });

  it('rejects unsupported runtimes', () => {
    expect(() => createSecuXAdapter({
      kind: 'real-device',
      transport: 'webhid',
    })).toThrow(UnsupportedOperationError);
  });
});
