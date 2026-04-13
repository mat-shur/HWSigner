import {
  DeviceConnectionError,
  DeviceNotFoundError,
  UnsupportedOperationError,
  UserRejectedError,
} from '../hwsigner/errors';

export function mapKeystoneError(error: unknown): Error {
  const message = getKeystoneErrorMessage(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes('cancel')
    || normalized.includes('reject')
    || normalized.includes('closed')
    || normalized.includes('declined')
  ) {
    return new UserRejectedError(message, { cause: error });
  }

  if (
    normalized.includes('not connected')
    || normalized.includes('not found')
    || normalized.includes('no account')
    || normalized.includes('empty keyring')
  ) {
    return new DeviceNotFoundError(message, { cause: error });
  }

  if (
    normalized.includes('not ready')
    || normalized.includes('unsupported')
    || normalized.includes('versioned-message-bytes')
    || normalized.includes('legacy-message-bytes')
  ) {
    return new UnsupportedOperationError(message, { cause: error });
  }

  return new DeviceConnectionError(message, { cause: error });
}

export function getKeystoneErrorMessage(error: unknown): string {
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
  }

  return 'Keystone request failed.';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}