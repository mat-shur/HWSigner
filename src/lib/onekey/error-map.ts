import {
  AdapterInitializationError,
  DeviceConnectionError,
  DeviceNotFoundError,
  TimeoutError,
  UnsupportedOperationError,
  UserRejectedError,
} from '@/lib/hwsigner/errors';

const USER_REJECTED_CODES = new Set(['109', '801', '802', '803', '822']);
const DEVICE_NOT_FOUND_CODES = new Set(['104', '105', '602', '901', '902']);
const INITIALIZATION_CODES = new Set(['200', '300', '301', '302', '303', '304', '305']);
const TIMEOUT_CODES = new Set(['713', '807', '809', '810']);
const UNSUPPORTED_CODES = new Set(['415', '722']);

export function mapOneKeyError(error: unknown): Error {
  const code = getOneKeyErrorCode(error);
  const message = getOneKeyErrorMessage(error);
  const normalized = message.toLowerCase();

  if (code && USER_REJECTED_CODES.has(code)) {
    return new UserRejectedError(message, { cause: error });
  }

  if (code && DEVICE_NOT_FOUND_CODES.has(code)) {
    return new DeviceNotFoundError(message, { cause: error });
  }

  if (code && INITIALIZATION_CODES.has(code)) {
    return new AdapterInitializationError(message, { cause: error });
  }

  if (code && TIMEOUT_CODES.has(code)) {
    return new TimeoutError(message, { cause: error });
  }

  if (code && UNSUPPORTED_CODES.has(code)) {
    return new UnsupportedOperationError(message, { cause: error });
  }

  if (
    normalized.includes('cancel')
    || normalized.includes('denied')
    || normalized.includes('rejected')
    || normalized.includes('closed')
  ) {
    return new UserRejectedError(message, { cause: error });
  }

  if (
    normalized.includes('device not found')
    || normalized.includes('please select the device to connect')
    || normalized.includes('needs permission')
    || normalized.includes('not found')
  ) {
    return new DeviceNotFoundError(message, { cause: error });
  }

  if (
    normalized.includes('not initialized')
    || normalized.includes('iframe')
    || normalized.includes('initialization')
  ) {
    return new AdapterInitializationError(message, { cause: error });
  }

  if (
    normalized.includes('timeout')
    || normalized.includes('timed out')
  ) {
    return new TimeoutError(message, { cause: error });
  }

  if (
    normalized.includes('not webusb environment')
    || normalized.includes('not available in this browser')
    || normalized.includes('unsupported')
  ) {
    return new UnsupportedOperationError(message, { cause: error });
  }

  return new DeviceConnectionError(message, { cause: error });
}

export function getOneKeyErrorMessage(error: unknown): string {
  if (isRecord(error)) {
    if (typeof error.error === 'string' && error.error) {
      return error.error;
    }

    if (typeof error.message === 'string' && error.message) {
      return error.message;
    }

    if (isRecord(error.payload)) {
      if (typeof error.payload.error === 'string' && error.payload.error) {
        return error.payload.error;
      }

      if (typeof error.payload.message === 'string' && error.payload.message) {
        return error.payload.message;
      }
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error) {
    return error;
  }

  return 'OneKey request failed.';
}

export function getOneKeyErrorCode(error: unknown): string | null {
  if (!isRecord(error)) {
    return null;
  }

  if (typeof error.code === 'number' || typeof error.code === 'string') {
    return String(error.code);
  }

  if (isRecord(error.payload) && (typeof error.payload.code === 'number' || typeof error.payload.code === 'string')) {
    return String(error.payload.code);
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
