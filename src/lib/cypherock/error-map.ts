'use client';

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
  HWSignerError,
  TimeoutError,
  UnsupportedOperationError,
  UserRejectedError,
} from '../hwsigner/errors';

export function mapCypherockError(error: unknown): HWSignerError {
  if (error instanceof HWSignerError) {
    return error;
  }

  if (error instanceof DeviceAppError) {
    switch (error.code) {
      case DeviceAppErrorType.USER_REJECTION:
        return new UserRejectedError(error.message, { cause: error });
      case DeviceAppErrorType.WALLET_NOT_FOUND:
        return new DeviceNotFoundError(error.message, { cause: error });
      case DeviceAppErrorType.DEVICE_ABORT:
      case DeviceAppErrorType.APP_TIMEOUT:
        return new TimeoutError(error.message, { cause: error });
      case DeviceAppErrorType.UNKNOWN_APP:
      case DeviceAppErrorType.APP_NOT_ACTIVE:
        return new UnsupportedOperationError(error.message, { cause: error });
      case DeviceAppErrorType.DEVICE_SETUP_REQUIRED:
      case DeviceAppErrorType.WALLET_PARTIAL_STATE:
      case DeviceAppErrorType.DEVICE_SESSION_INVALID:
      case DeviceAppErrorType.DEVICE_AUTH_FAILED:
      case DeviceAppErrorType.CARD_AUTH_FAILED:
      case DeviceAppErrorType.CARD_OPERATION_FAILED:
        return new AdapterInitializationError(error.message, { cause: error });
      default:
        return new DeviceConnectionError(error.message, { cause: error });
    }
  }

  if (error instanceof DeviceCompatibilityError) {
    switch (error.code) {
      case DeviceCompatibilityErrorType.DEVICE_NOT_SUPPORTED:
      case DeviceCompatibilityErrorType.INVALID_SDK_OPERATION:
        return new UnsupportedOperationError(error.message, { cause: error });
      default:
        return new DeviceConnectionError(error.message, { cause: error });
    }
  }

  if (error instanceof DeviceCommunicationError) {
    switch (error.code) {
      case DeviceCommunicationErrorType.WRITE_TIMEOUT:
      case DeviceCommunicationErrorType.READ_TIMEOUT:
        return new TimeoutError(error.message, { cause: error });
      default:
        return new DeviceConnectionError(error.message, { cause: error });
    }
  }

  if (error instanceof CypherockSdkConnectionError) {
    switch (error.code) {
      case DeviceConnectionErrorType.FAILED_TO_CONNECT:
        return new DeviceNotFoundError(error.message, { cause: error });
      case DeviceConnectionErrorType.NOT_CONNECTED:
      case DeviceConnectionErrorType.CONNECTION_CLOSED:
      default:
        return new DeviceConnectionError(error.message, { cause: error });
    }
  }

  const message = getCypherockErrorMessage(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes('no device selected')
    || normalized.includes('user cancelled')
    || normalized.includes('user canceled')
    || normalized.includes('notfounderror')
  ) {
    return new UserRejectedError('Cypherock WebUSB selection was cancelled.', { cause: error });
  }

  if (normalized.includes('webusb is not available') || normalized.includes('secure context')) {
    return new UnsupportedOperationError(message, { cause: error });
  }

  if (normalized.includes('no device connected') || normalized.includes('failed to create device connection')) {
    return new DeviceNotFoundError(message, { cause: error });
  }

  return new DeviceConnectionError(message, { cause: error });
}

export function getCypherockErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;

    if (typeof record.message === 'string' && record.message) {
      return record.message;
    }

    if (typeof record.code === 'string' && record.code) {
      return record.code;
    }
  }

  return 'Cypherock operation failed.';
}