import {
  AdapterInitializationError,
  DeviceConnectionError,
  DeviceNotFoundError,
  UnsupportedOperationError,
  UserRejectedError,
} from '@/lib/hwsigner/errors';

export function mapKeyPalError(error: unknown): Error {
  const message = getKeyPalErrorMessage(error);
  const normalized = message.toLowerCase();
  const name = getKeyPalErrorName(error);

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
    normalized.includes('not initialized')
    || normalized.includes('provider')
  ) {
    return new AdapterInitializationError(message, { cause: error });
  }

  if (
    name === 'WalletNotReadyError'
    || normalized.includes('not ready')
    || normalized.includes('not detected')
    || normalized.includes('not installed')
    || normalized.includes('tokenpocket')
  ) {
    return new DeviceNotFoundError(message, { cause: error });
  }

  if (
    normalized.includes('unsupported')
    || normalized.includes('versioned transaction')
    || normalized.includes('legacy-message-bytes')
    || normalized.includes('versioned-message-bytes')
  ) {
    return new UnsupportedOperationError(message, { cause: error });
  }

  return new DeviceConnectionError(message, { cause: error });
}

export function getKeyPalErrorMessage(error: unknown): string {
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

    if (isRecord(error.error) && typeof error.error.message === 'string' && error.error.message) {
      return error.error.message;
    }
  }

  return 'KeyPal TokenPocket request failed.';
}

function getKeyPalErrorName(error: unknown): string {
  if (error instanceof Error && error.name) {
    return error.name;
  }

  if (isRecord(error) && typeof error.name === 'string' && error.name) {
    return error.name;
  }

  return '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
