import { describe, expect, it } from 'vitest';

import {
  AdapterInitializationError,
  DeviceConnectionError,
  DeviceNotFoundError,
  TimeoutError,
  UnsupportedOperationError,
  UserRejectedError,
} from '../hwsigner/errors';
import { getOneKeyErrorCode, getOneKeyErrorMessage, mapOneKeyError } from './error-map';

describe('OneKey error map', () => {
  it('maps user rejection codes', () => {
    expect(mapOneKeyError({
      code: 803,
      error: 'Action cancelled',
    })).toBeInstanceOf(UserRejectedError);
  });

  it('maps device discovery failures', () => {
    expect(mapOneKeyError({
      payload: {
        code: 901,
        error: 'Web device not found or needs permission',
      },
    })).toBeInstanceOf(DeviceNotFoundError);
  });

  it('maps initialization failures', () => {
    expect(mapOneKeyError({
      payload: {
        code: 200,
        error: 'Not initialized',
      },
    })).toBeInstanceOf(AdapterInitializationError);
  });

  it('maps unsupported runtime failures', () => {
    expect(mapOneKeyError({
      payload: {
        code: 415,
        error: 'Device not support method',
      },
    })).toBeInstanceOf(UnsupportedOperationError);
  });

  it('maps timeout failures', () => {
    expect(mapOneKeyError({
      payload: {
        code: 809,
        error: 'Polling timeout',
      },
    })).toBeInstanceOf(TimeoutError);
  });

  it('falls back to device connection errors', () => {
    expect(mapOneKeyError({
      payload: {
        error: 'Transport call in progress',
      },
    })).toBeInstanceOf(DeviceConnectionError);
  });

  it('extracts message and code from nested payloads', () => {
    const error = {
      payload: {
        code: 902,
        error: 'Please select the device to connect',
      },
    };

    expect(getOneKeyErrorCode(error)).toBe('902');
    expect(getOneKeyErrorMessage(error)).toBe('Please select the device to connect');
  });
});