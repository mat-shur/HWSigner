import { describe, expect, it } from 'vitest';

import {
  AdapterInitializationError,
  DeviceConnectionError,
  DeviceNotFoundError,
  UnsupportedOperationError,
  UserRejectedError,
} from '@/lib/hwsigner/errors';
import { getTrezorErrorMessage, mapTrezorError } from '@/lib/trezor/error-map';

describe('Trezor error mapping', () => {
  it('maps user cancellations into UserRejectedError', () => {
    expect(mapTrezorError({ error: 'Canceled' })).toBeInstanceOf(UserRejectedError);
    expect(mapTrezorError({ payload: { error: 'Popup closed' } })).toBeInstanceOf(UserRejectedError);
  });

  it('maps missing device style failures into DeviceNotFoundError', () => {
    expect(mapTrezorError({ error: 'Device not found' })).toBeInstanceOf(DeviceNotFoundError);
    expect(mapTrezorError({ error: 'Transport is missing' })).toBeInstanceOf(DeviceNotFoundError);
  });

  it('maps connection style failures into DeviceConnectionError', () => {
    expect(mapTrezorError({ error: 'Device disconnected' })).toBeInstanceOf(DeviceConnectionError);
  });

  it('maps init failures into AdapterInitializationError', () => {
    expect(mapTrezorError({ error: 'Manifest not set' })).toBeInstanceOf(AdapterInitializationError);
  });

  it('maps unsupported paths into UnsupportedOperationError', () => {
    expect(mapTrezorError({ error: 'Unsupported method' })).toBeInstanceOf(UnsupportedOperationError);
  });

  it('extracts message text from payload containers', () => {
    expect(getTrezorErrorMessage({ payload: { error: 'Popup closed' } })).toBe('Popup closed');
  });
});
