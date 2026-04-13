import type { HWSignerCapabilities, HWSignerRuntime } from './types';

export function getLedgerCapabilities(runtime: HWSignerRuntime): HWSignerCapabilities {
  return {
    connect: true,
    disconnect: true,
    getAccounts: true,
    signMessage: true,
    signTransaction: true,
    signVersionedTransaction: true,
    emulator: runtime.kind === 'speculos',
    usb: runtime.kind === 'real-device',
    ble: false,
    qr: false,
    nfc: false,
  };
}