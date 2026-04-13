import { describe, expect, it } from 'vitest';

import {
  AdapterInitializationError,
  DeviceConnectionError,
  DeviceNotFoundError,
  UnsupportedOperationError,
  UserRejectedError,
} from '../hwsigner/errors';
import { getSafePalErrorMessage, mapSafePalError } from './error-map';

describe('SafePal error map', () => {
  it('maps user rejection strings', () => {
    expect(mapSafePalError(new Error('User rejected request'))).toBeInstanceOf(UserRejectedError);
  });

  it('maps missing provider errors', () => {
    expect(mapSafePalError(new Error('SafePal provider was not found'))).toBeInstanceOf(DeviceNotFoundError);
  });

  it('maps initialization errors', () => {
    expect(mapSafePalError(new Error('SafePal provider does not expose connect().'))).toBeInstanceOf(AdapterInitializationError);
  });

  it('maps unsupported mode errors', () => {
    expect(mapSafePalError('versioned transaction signing is not supported')).toBeInstanceOf(UnsupportedOperationError);
  });

  it('falls back to device connection errors', () => {
    expect(mapSafePalError(new Error('SafePal request failed'))).toBeInstanceOf(DeviceConnectionError);
  });

  it('extracts messages from payload objects', () => {
    expect(getSafePalErrorMessage({ message: 'Popup closed' })).toBe('Popup closed');
  });
});