import { describe, expect, it } from 'vitest';

import {
  AdapterInitializationError,
  DeviceConnectionError,
  DeviceNotFoundError,
  UnsupportedOperationError,
  UserRejectedError,
} from '@/lib/hwsigner/errors';
import { getKeyPalErrorMessage, mapKeyPalError } from '@/lib/keypal/error-map';

describe('KeyPal error mapping', () => {
  it('maps user rejection into UserRejectedError', () => {
    expect(mapKeyPalError(new Error('User rejected request'))).toBeInstanceOf(UserRejectedError);
  });

  it('maps TokenPocket not-ready errors into DeviceNotFoundError', () => {
    expect(mapKeyPalError({ name: 'WalletNotReadyError', message: 'wallet not ready' })).toBeInstanceOf(DeviceNotFoundError);
  });

  it('maps provider setup errors into AdapterInitializationError', () => {
    expect(mapKeyPalError('TokenPocket provider was not initialized')).toBeInstanceOf(AdapterInitializationError);
  });

  it('maps unsupported versioned mode into UnsupportedOperationError', () => {
    expect(mapKeyPalError('versioned transaction unsupported')).toBeInstanceOf(UnsupportedOperationError);
  });

  it('falls back to DeviceConnectionError for unknown failures', () => {
    expect(mapKeyPalError('unexpected keypal failure')).toBeInstanceOf(DeviceConnectionError);
  });

  it('extracts nested messages', () => {
    expect(getKeyPalErrorMessage({
      error: {
        message: 'TokenPocket broke',
      },
    })).toBe('TokenPocket broke');
  });
});
