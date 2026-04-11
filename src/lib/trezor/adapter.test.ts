import { describe, expect, it } from 'vitest';

import { UnsupportedOperationError } from '@/lib/hwsigner/errors';
import { createTrezorAdapter } from '@/lib/trezor/adapter';

describe('Trezor adapter', () => {
  it('exposes the expected capability shape for trezor-connect', () => {
    const adapter = createTrezorAdapter({
      kind: 'trezor-connect',
      transport: 'popup-bridge',
    });

    expect(adapter.getCapabilities()).toMatchObject({
      connect: true,
      disconnect: true,
      getAccounts: true,
      signMessage: false,
      signTransaction: true,
      signVersionedTransaction: true,
      usb: true,
      ble: false,
      qr: false,
      nfc: false,
    });
  });

  it('rejects unsupported runtimes', () => {
    expect(() => createTrezorAdapter({
      kind: 'real-device',
      transport: 'webhid',
    })).toThrow(UnsupportedOperationError);
  });
});
