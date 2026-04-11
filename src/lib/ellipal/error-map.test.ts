import { describe, expect, it } from 'vitest';

import {
  AdapterInitializationError,
  DeviceConnectionError,
  UnsupportedOperationError,
  UserRejectedError,
} from '@/lib/hwsigner/errors';
import { getEllipalErrorMessage, mapEllipalError } from '@/lib/ellipal/error-map';

describe('ELLIPAL error mapping', () => {
  it('maps wallet window close into UserRejectedError', () => {
    expect(mapEllipalError({ name: 'WalletWindowClosedError', message: 'window closed' })).toBeInstanceOf(UserRejectedError);
  });

  it('maps unsupported WalletConnect methods into UnsupportedOperationError', () => {
    expect(mapEllipalError({ name: 'WalletConnectFeatureNotSupportedError', message: 'not supported by the wallet' })).toBeInstanceOf(UnsupportedOperationError);
  });

  it('maps missing WalletConnect config into AdapterInitializationError', () => {
    expect(mapEllipalError('WalletConnect Adapter: Project ID is undefined')).toBeInstanceOf(AdapterInitializationError);
  });

  it('falls back to DeviceConnectionError for unknown failures', () => {
    expect(mapEllipalError('unexpected ellipal failure')).toBeInstanceOf(DeviceConnectionError);
  });

  it('extracts message text from plain objects', () => {
    expect(getEllipalErrorMessage({ message: 'ellipal broke' })).toBe('ellipal broke');
  });
});
