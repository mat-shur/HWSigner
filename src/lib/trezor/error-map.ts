import {
  AdapterInitializationError,
  DeviceConnectionError,
  DeviceNotFoundError,
  UnsupportedOperationError,
  UserRejectedError,
} from '@/lib/hwsigner/errors';

export function mapTrezorError(error: unknown): Error {
  const message = getTrezorErrorMessage(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes('canceled')
    || normalized.includes('cancelled')
    || normalized.includes('popup closed')
    || normalized.includes('permissions not granted')
  ) {
    return new UserRejectedError(message, { cause: error });
  }

  if (
    normalized.includes('device not found')
    || normalized.includes('transport is missing')
    || normalized.includes('no device')
  ) {
    return new DeviceNotFoundError(message, { cause: error });
  }

  if (
    normalized.includes('device disconnected')
    || normalized.includes('device is used in another window')
    || normalized.includes('call in progress')
    || normalized.includes('unable to establish connection')
    || normalized.includes('iframe timeout')
  ) {
    return new DeviceConnectionError(message, { cause: error });
  }

  if (
    normalized.includes('manifest not set')
    || normalized.includes('not initialized')
    || normalized.includes('already initialized')
  ) {
    return new AdapterInitializationError(message, { cause: error });
  }

  if (
    normalized.includes('unsupported method')
    || normalized.includes('method not allowed')
    || normalized.includes('browser does not support webusb')
  ) {
    return new UnsupportedOperationError(message, { cause: error });
  }

  return new DeviceConnectionError(message, { cause: error });
}

export function getTrezorErrorMessage(error: unknown): string {
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

  return 'Trezor Connect request failed.';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
