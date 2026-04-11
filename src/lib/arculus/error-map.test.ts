import { describe, expect, it } from 'vitest';

import {
  AdapterInitializationError,
  DeviceConnectionError,
  UnsupportedOperationError,
  UserRejectedError,
} from '@/lib/hwsigner/errors';
import { getArculusErrorMessage, mapArculusError } from '@/lib/arculus/error-map';

describe('Arculus error mapping', () => {
  it('maps wallet window close into UserRejectedError', () => {
    expect(mapArculusError({ name: 'WalletWindowClosedError', message: 'window closed' })).toBeInstanceOf(UserRejectedError);
  });

  it('maps unsupported WalletConnect methods into UnsupportedOperationError', () => {
    expect(mapArculusError({ name: 'WalletConnectFeatureNotSupportedError', message: 'not supported by the wallet' })).toBeInstanceOf(UnsupportedOperationError);
  });

  it('maps missing WalletConnect config into AdapterInitializationError', () => {
    expect(mapArculusError('WalletConnect Adapter: Project ID is undefined')).toBeInstanceOf(AdapterInitializationError);
  });

  it('falls back to DeviceConnectionError for unknown failures', () => {
    expect(mapArculusError('unexpected arculus failure')).toBeInstanceOf(DeviceConnectionError);
  });

  it('extracts message text from plain objects', () => {
    expect(getArculusErrorMessage({ message: 'arculus broke' })).toBe('arculus broke');
  });
});
