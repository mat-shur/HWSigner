import { describe, expect, it } from 'vitest';

import { getLedgerCapabilities } from '../hwsigner/capabilities';
import { AdapterInitializationError, UnsupportedOperationError } from '../hwsigner/errors';
import { resolveSpeculosEnabled } from './env';
import { validateSpeculosUrl } from './speculos';

describe('Speculos helpers', () => {
  it('returns an honest capability shape for the emulator runtime', () => {
    expect(getLedgerCapabilities({
      kind: 'speculos',
      apiBaseUrl: '/api/ledger/speculos',
    })).toEqual({
      connect: true,
      disconnect: true,
      getAccounts: true,
      signMessage: true,
      signTransaction: true,
      signVersionedTransaction: true,
      emulator: true,
      usb: false,
      ble: false,
      qr: false,
      nfc: false,
    });
  });

  it('normalizes valid Speculos URLs', () => {
    expect(validateSpeculosUrl('http://127.0.0.1:5000/')).toBe('http://127.0.0.1:5000');
  });

  it('enables Speculos automatically outside production when no flag is set', () => {
    expect(resolveSpeculosEnabled({
      NODE_ENV: 'development',
      NEXT_PUBLIC_ENABLE_SPECULOS: undefined,
    })).toBe(true);
  });

  it('lets the explicit env flag disable Speculos even in development', () => {
    expect(resolveSpeculosEnabled({
      NODE_ENV: 'development',
      NEXT_PUBLIC_ENABLE_SPECULOS: 'false',
    })).toBe(false);
  });

  it('keeps Speculos disabled by default in production', () => {
    expect(resolveSpeculosEnabled({
      NODE_ENV: 'production',
      NEXT_PUBLIC_ENABLE_SPECULOS: undefined,
    })).toBe(false);
  });

  it('rejects malformed or unsupported Speculos URLs', () => {
    expect(() => validateSpeculosUrl('not-a-url')).toThrow(AdapterInitializationError);
    expect(() => validateSpeculosUrl('ftp://127.0.0.1:5000')).toThrow(UnsupportedOperationError);
  });
});