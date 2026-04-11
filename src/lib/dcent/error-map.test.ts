import { describe, expect, it } from 'vitest';

import {
  AdapterInitializationError,
  DeviceConnectionError,
  UnsupportedOperationError,
  UserRejectedError,
} from '@/lib/hwsigner/errors';
import { getDcentErrorMessage, mapDcentError } from '@/lib/dcent/error-map';

describe("D'CENT error mapping", () => {
  it('maps wallet window close into UserRejectedError', () => {
    expect(mapDcentError({ name: 'WalletWindowClosedError', message: 'window closed' })).toBeInstanceOf(UserRejectedError);
  });

  it('maps unsupported WalletConnect methods into UnsupportedOperationError', () => {
    expect(mapDcentError({ name: 'WalletConnectFeatureNotSupportedError', message: 'not supported by the wallet' })).toBeInstanceOf(UnsupportedOperationError);
  });

  it('maps missing WalletConnect config into AdapterInitializationError', () => {
    expect(mapDcentError('WalletConnect Adapter: Project ID is undefined')).toBeInstanceOf(AdapterInitializationError);
  });

  it('falls back to DeviceConnectionError for unknown failures', () => {
    expect(mapDcentError('unexpected dcent failure')).toBeInstanceOf(DeviceConnectionError);
  });

  it('extracts message text from plain objects', () => {
    expect(getDcentErrorMessage({ message: 'dcent broke' })).toBe('dcent broke');
  });
});
