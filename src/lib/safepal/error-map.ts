import {
  AdapterInitializationError,
  DeviceConnectionError,
  DeviceNotFoundError,
  UnsupportedOperationError,
  UserRejectedError,
} from '@/lib/hwsigner/errors';

export function mapSafePalError(error: unknown): Error {
  const message = getSafePalErrorMessage(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes('cancel')
    || normalized.includes('reject')
    || normalized.includes('denied')
    || normalized.includes('declined')
    || normalized.includes('closed')
  ) {
    return new UserRejectedError(message, { cause: error });
  }

  if (
    normalized.includes('install safepal')
    || normalized.includes('extension')
    || normalized.includes('download')
    || normalized.includes('not detected')
    || normalized.includes('provider was not found')
  ) {
    return new DeviceNotFoundError(message, { cause: error });
  }

  if (
    normalized.includes('not initialized')
    || normalized.includes('connect()')
    || normalized.includes('getaccount()')
  ) {
    return new AdapterInitializationError(message, { cause: error });
  }

  if (
    normalized.includes('not supported')
    || normalized.includes('versioned transaction')
    || normalized.includes('legacy-message-bytes')
    || normalized.includes('versioned-message-bytes')
  ) {
    return new UnsupportedOperationError(message, { cause: error });
  }

  return new DeviceConnectionError(message, { cause: error });
}

export function getSafePalErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error) {
    return error;
  }

  if (isRecord(error)) {
    if (typeof error.message === 'string' && error.message) {
      return error.message;
    }

    if (typeof error.error === 'string' && error.error) {
      return error.error;
    }

    if (isRecord(error.data) && typeof error.data.message === 'string' && error.data.message) {
      return error.data.message;
    }
  }

  return 'SafePal request failed.';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
