import { describe, expect, it } from 'vitest';

import {
  AdapterInitializationError,
  DeviceConnectionError,
  UnsupportedOperationError,
  UserRejectedError,
} from '../hwsigner/errors';
import { getBcVaultErrorMessage, mapBcVaultError } from './error-map';

describe('BC Vault error mapping', () => {
  it('maps wallet window close into UserRejectedError', () => {
    expect(mapBcVaultError({ name: 'WalletWindowClosedError', message: 'window closed' })).toBeInstanceOf(UserRejectedError);
  });

  it('maps unsupported WalletConnect methods into UnsupportedOperationError', () => {
    expect(mapBcVaultError({ name: 'WalletConnectFeatureNotSupportedError', message: 'not supported by the wallet' })).toBeInstanceOf(UnsupportedOperationError);
  });

  it('maps missing WalletConnect config into AdapterInitializationError', () => {
    expect(mapBcVaultError('WalletConnect Adapter: Project ID is undefined')).toBeInstanceOf(AdapterInitializationError);
  });

  it('falls back to DeviceConnectionError for unknown failures', () => {
    expect(mapBcVaultError('unexpected bc vault failure')).toBeInstanceOf(DeviceConnectionError);
  });

  it('extracts message text from plain objects', () => {
    expect(getBcVaultErrorMessage({ message: 'bc vault broke' })).toBe('bc vault broke');
  });
});