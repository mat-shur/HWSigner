'use client';

import {
  DeviceConnectionError,
  DeviceNotFoundError,
  HWSignerError,
  InvalidTransactionError,
  TimeoutError,
  UnsupportedOperationError,
  UserRejectedError,
} from '../hwsigner/errors';

const SECUX_STATUS_USER_CANCEL = 36865;
const SECUX_STATUS_DATA_ERROR = 20481;
const SECUX_STATUS_CLA_ERROR = 20482;
const SECUX_STATUS_INS_ERROR = 20483;
const SECUX_STATUS_V2_NOT_FOUND = 6;
const SECUX_STATUS_V2_IO_ERROR = 8;
const SECUX_STATUS_V2_NOT_SUPPORT = 9;

export function mapSecuXError(error: unknown): HWSignerError {
  if (error instanceof HWSignerError) {
    return error;
  }

  const message = getSecuXErrorMessage(error);
  const statusCode = getSecuXStatusCode(error);

  if (statusCode !== null) {
    switch (statusCode) {
      case SECUX_STATUS_USER_CANCEL:
        return new UserRejectedError('The request was rejected on the SecuX device.', { cause: error });
      case SECUX_STATUS_DATA_ERROR:
        return new InvalidTransactionError(message, { cause: error });
      case SECUX_STATUS_CLA_ERROR:
      case SECUX_STATUS_INS_ERROR:
      case SECUX_STATUS_V2_NOT_SUPPORT:
        return new UnsupportedOperationError(message, { cause: error });
      case SECUX_STATUS_V2_NOT_FOUND:
        return new DeviceNotFoundError(message, { cause: error });
      case SECUX_STATUS_V2_IO_ERROR:
        return new DeviceConnectionError(message, { cause: error });
      default:
        return new DeviceConnectionError(message, { cause: error });
    }
  }

  const normalized = message.toLowerCase();

  if (
    normalized.includes('notfounderror')
    || normalized.includes('no device selected')
    || normalized.includes('user cancelled')
    || normalized.includes('user canceled')
    || normalized.includes('request device')
  ) {
    return new UserRejectedError('SecuX WebUSB selection was cancelled.', { cause: error });
  }

  if (
    normalized.includes('webusb is not available')
    || normalized.includes('secure context')
    || normalized.includes('not available in this browser')
    || normalized.includes('can only run in a browser')
  ) {
    return new UnsupportedOperationError(message, { cause: error });
  }

  if (
    normalized.includes('timeout')
    || normalized.includes('timed out')
  ) {
    return new TimeoutError(message, { cause: error });
  }

  if (
    normalized.includes('failed to write data to device')
    || normalized.includes('failed to read data from device')
    || normalized.includes('disconnected')
    || normalized.includes('connection')
  ) {
    return new DeviceConnectionError(message, { cause: error });
  }

  return new DeviceConnectionError(message, { cause: error });
}

export function getSecuXErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error) {
    return error;
  }

  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;

    if (typeof record.message === 'string' && record.message) {
      return record.message;
    }

    if (typeof record.statusText === 'string' && record.statusText) {
      return record.statusText;
    }
  }

  return 'SecuX request failed.';
}

function getSecuXStatusCode(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const record = error as Record<string, unknown>;

  if (typeof record.statusCode === 'number') {
    return record.statusCode;
  }

  if (typeof record.code === 'number') {
    return record.code;
  }

  return null;
}