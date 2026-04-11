import { describe, expect, it } from 'vitest';

import {
  DeviceConnectionError,
  DeviceNotFoundError,
  UnsupportedOperationError,
  UserRejectedError,
} from '@/lib/hwsigner/errors';
import { getKeystoneErrorMessage, mapKeystoneError } from '@/lib/keystone/error-map';

describe('Keystone error map', () => {
  it('maps user rejection strings', () => {
    expect(mapKeystoneError(new Error('User rejected request'))).toBeInstanceOf(UserRejectedError);
  });

  it('maps missing account errors', () => {
    expect(mapKeystoneError(new Error('No account found in keyring'))).toBeInstanceOf(DeviceNotFoundError);
  });

  it('maps unsupported mode errors', () => {
    expect(mapKeystoneError('legacy-message-bytes is not supported')).toBeInstanceOf(UnsupportedOperationError);
  });

  it('falls back to device connection errors', () => {
    expect(mapKeystoneError(new Error('Keystone request failed'))).toBeInstanceOf(DeviceConnectionError);
  });

  it('extracts messages from generic errors', () => {
    expect(getKeystoneErrorMessage(new Error('Popup closed'))).toBe('Popup closed');
  });
});
