import { describe, expect, it } from 'vitest';

import { UnsupportedOperationError } from '@/lib/hwsigner/errors';
import { createSafePalAdapter } from '@/lib/safepal/adapter';

describe('SafePal adapter', () => {
  it('exposes the expected capability shape for the injected provider runtime', () => {
    const adapter = createSafePalAdapter({
      kind: 'safepal-provider',
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
    expect(() => createSafePalAdapter({
      kind: 'real-device',
      transport: 'webhid',
    })).toThrow(UnsupportedOperationError);
  });
});
