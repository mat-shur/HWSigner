import { describe, expect, it } from 'vitest';
import {
  DeviceAppError,
  DeviceAppErrorType,
  DeviceCommunicationError,
  DeviceCommunicationErrorType,
  DeviceCompatibilityError,
  DeviceCompatibilityErrorType,
  DeviceConnectionError as CypherockSdkConnectionError,
  DeviceConnectionErrorType,
} from '@cypherock/sdk-interfaces';

import {
  AdapterInitializationError,
  DeviceConnectionError,
  DeviceNotFoundError,
  TimeoutError,
  UnsupportedOperationError,
  UserRejectedError,
} from '@/lib/hwsigner/errors';
import { getCypherockErrorMessage, mapCypherockError } from '@/lib/cypherock/error-map';

describe('Cypherock error mapping', () => {
  it('maps user rejection into UserRejectedError', () => {
    expect(mapCypherockError(new DeviceAppError(DeviceAppErrorType.USER_REJECTION))).toBeInstanceOf(UserRejectedError);
  });

  it('maps wallet lookup failures into DeviceNotFoundError', () => {
    expect(mapCypherockError(new DeviceAppError(DeviceAppErrorType.WALLET_NOT_FOUND))).toBeInstanceOf(DeviceNotFoundError);
    expect(mapCypherockError(new CypherockSdkConnectionError(DeviceConnectionErrorType.FAILED_TO_CONNECT))).toBeInstanceOf(DeviceNotFoundError);
  });

  it('maps timeouts into TimeoutError', () => {
    expect(mapCypherockError(new DeviceAppError(DeviceAppErrorType.APP_TIMEOUT))).toBeInstanceOf(TimeoutError);
    expect(mapCypherockError(new DeviceCommunicationError(DeviceCommunicationErrorType.READ_TIMEOUT))).toBeInstanceOf(TimeoutError);
  });

  it('maps compatibility failures into UnsupportedOperationError', () => {
    expect(mapCypherockError(new DeviceCompatibilityError(DeviceCompatibilityErrorType.INVALID_SDK_OPERATION))).toBeInstanceOf(UnsupportedOperationError);
  });

  it('maps device setup issues into AdapterInitializationError', () => {
    expect(mapCypherockError(new DeviceAppError(DeviceAppErrorType.DEVICE_SETUP_REQUIRED))).toBeInstanceOf(AdapterInitializationError);
  });

  it('falls back to DeviceConnectionError for unknown failures', () => {
    expect(mapCypherockError('unexpected cypherock failure')).toBeInstanceOf(DeviceConnectionError);
  });

  it('extracts message text from plain objects', () => {
    expect(getCypherockErrorMessage({ message: 'cypherock broke' })).toBe('cypherock broke');
  });
});
