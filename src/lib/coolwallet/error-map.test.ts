import { describe, expect, it } from 'vitest';

import {
  AdapterInitializationError,
  DeviceConnectionError,
  DeviceNotFoundError,
  UnsupportedOperationError,
  UserRejectedError,
} from '@/lib/hwsigner/errors';
import { getCoolWalletErrorMessage, mapCoolWalletError } from '@/lib/coolwallet/error-map';

describe('CoolWallet error mapping', () => {
  it('maps chooser cancellations into UserRejectedError', () => {
    expect(mapCoolWalletError(new Error('User cancelled the requestDevice() chooser.'))).toBeInstanceOf(UserRejectedError);
  });

  it('maps bluetooth discovery failures into DeviceNotFoundError', () => {
    expect(mapCoolWalletError('Bluetooth device not found')).toBeInstanceOf(DeviceNotFoundError);
  });

  it('maps app registration failures into AdapterInitializationError', () => {
    expect(mapCoolWalletError('appid need registered')).toBeInstanceOf(AdapterInitializationError);
    expect(mapCoolWalletError('pairing password is required')).toBeInstanceOf(AdapterInitializationError);
  });

  it('maps unsupported payload modes into UnsupportedOperationError', () => {
    expect(mapCoolWalletError('legacy-message-bytes is not supported')).toBeInstanceOf(UnsupportedOperationError);
  });

  it('falls back to DeviceConnectionError for unknown failures', () => {
    expect(mapCoolWalletError('unexpected exchange failure')).toBeInstanceOf(DeviceConnectionError);
  });

  it('extracts message text from plain objects', () => {
    expect(getCoolWalletErrorMessage({ message: 'coolwallet broke' })).toBe('coolwallet broke');
  });
});
