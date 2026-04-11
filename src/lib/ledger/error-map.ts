import {
  DeviceBusyError,
  DeviceLockedError,
  NoAccessibleDeviceError,
  OpeningConnectionError,
  RefusedByUserDAError,
  SendApduTimeoutError,
  SendCommandTimeoutError,
  TransportNotSupportedError,
  UnknownDeviceError,
  type DmkError,
} from '@ledgerhq/device-management-kit';
import { WebHidTransportNotSupportedError } from '@ledgerhq/device-transport-kit-web-hid';

import {
  AdapterInitializationError,
  DeviceConnectionError,
  DeviceNotFoundError,
  TimeoutError,
  UnsupportedOperationError,
  UserRejectedError,
  getErrorCode,
  getErrorMessage,
} from '@/lib/hwsigner/errors';

const USER_REJECTED_CODES = new Set([6982]);

export function mapLedgerError(error: unknown): Error {
  const nestedErrorCode = getErrorCode(error);
  const directErrorCode = isCommandErrorLike(error) ? error.errorCode : null;
  const errorCode =
    nestedErrorCode ??
    (typeof directErrorCode === 'number' || typeof directErrorCode === 'string'
      ? String(directErrorCode).toLowerCase()
      : null);

  if (error instanceof UserRejectedError) {
    return error;
  }

  if (error instanceof NoAccessibleDeviceError || error instanceof UnknownDeviceError) {
    return new DeviceNotFoundError(getErrorMessage(error), { cause: error });
  }

  if (error instanceof OpeningConnectionError || error instanceof DeviceBusyError || error instanceof DeviceLockedError) {
    return new DeviceConnectionError(getErrorMessage(error), { cause: error });
  }

  if (
    error instanceof SendApduTimeoutError ||
    error instanceof SendCommandTimeoutError ||
    hasLedgerTag(error, 'SendApduTimeoutError') ||
    hasLedgerTag(error, 'SendCommandTimeoutError')
  ) {
    return new TimeoutError(getErrorMessage(error), { cause: error });
  }

  if (
    error instanceof TransportNotSupportedError ||
    error instanceof WebHidTransportNotSupportedError ||
    hasLedgerTag(error, 'TransportNotSupportedError') ||
    hasLedgerTag(error, 'WebHidTransportNotSupportedError')
  ) {
    return new UnsupportedOperationError(getErrorMessage(error), { cause: error });
  }

  if (error instanceof RefusedByUserDAError || hasLedgerTag(error, 'RefusedByUserDAError')) {
    return new UserRejectedError(getErrorMessage(error), { cause: error });
  }

  if (errorCode !== null && USER_REJECTED_CODES.has(Number(errorCode))) {
    return new UserRejectedError(getErrorMessage(error), { cause: error });
  }

  if (hasLedgerTag(error, 'UnknownDAError')) {
    return new DeviceConnectionError(getErrorMessage(error), { cause: error });
  }

  if (hasLedgerTag(error, 'DeviceNotInitializedError')) {
    return new AdapterInitializationError(getErrorMessage(error), { cause: error });
  }

  if (isDmkError(error)) {
    return new DeviceConnectionError(getErrorMessage(error), { cause: error });
  }

  return error instanceof Error ? error : new DeviceConnectionError(getErrorMessage(error), { cause: error });
}

function isDmkError(error: unknown): error is DmkError {
  return typeof error === 'object' && error !== null && '_tag' in error;
}

function hasLedgerTag(error: unknown, tag: string): boolean {
  return isDmkError(error) && error._tag === tag;
}

function isCommandErrorLike(error: unknown): error is { errorCode?: number | string; message?: string } {
  return typeof error === 'object' && error !== null && 'errorCode' in error;
}
