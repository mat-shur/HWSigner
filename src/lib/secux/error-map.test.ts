import { describe, expect, it } from 'vitest';

import {
  DeviceConnectionError,
  InvalidTransactionError,
  UnsupportedOperationError,
  UserRejectedError,
} from '../hwsigner/errors';
import { getSecuXErrorMessage, mapSecuXError } from './error-map';

describe('SecuX error mapping', () => {
  it('maps device user cancellation into UserRejectedError', () => {
    expect(mapSecuXError({ message: 'user canceled', statusCode: 36865 })).toBeInstanceOf(UserRejectedError);
    expect(mapSecuXError({ message: 'NotFoundError: No device selected.' })).toBeInstanceOf(UserRejectedError);
  });

  it('maps transport data errors into InvalidTransactionError', () => {
    expect(mapSecuXError({ message: 'invalid data', statusCode: 20481 })).toBeInstanceOf(InvalidTransactionError);
  });

  it('maps unsupported environment errors into UnsupportedOperationError', () => {
    expect(mapSecuXError('WebUSB is not available in this browser.')).toBeInstanceOf(UnsupportedOperationError);
  });

  it('falls back to DeviceConnectionError for unknown failures', () => {
    expect(mapSecuXError('unexpected secux failure')).toBeInstanceOf(DeviceConnectionError);
  });

  it('extracts message text from plain objects', () => {
    expect(getSecuXErrorMessage({ message: 'secux broke' })).toBe('secux broke');
  });
});