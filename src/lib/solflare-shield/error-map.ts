import {
  AdapterInitializationError,
  DeviceConnectionError,
  DeviceNotFoundError,
  UnsupportedOperationError,
  UserRejectedError,
} from '@/lib/hwsigner/errors';

export function mapSolflareShieldError(error: unknown): Error {
  const message = getSolflareShieldErrorMessage(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes('cancel')
    || normalized.includes('reject')
    || normalized.includes('denied')
    || normalized.includes('declined')
    || normalized.includes('closed')
    || normalized.includes('user')
  ) {
    return new UserRejectedError(message, { cause: error });
  }

  if (
    normalized.includes('not found')
    || normalized.includes('not installed')
    || normalized.includes('no provider')
    || normalized.includes('not detected')
  ) {
    return new DeviceNotFoundError(message, { cause: error });
  }

  if (
    normalized.includes('not initialized')
    || normalized.includes('constructor')
    || normalized.includes('sdk')
  ) {
    return new AdapterInitializationError(message, { cause: error });
  }

  if (
    normalized.includes('unsupported')
    || normalized.includes('legacy-message-bytes')
    || normalized.includes('versioned-message-bytes')
  ) {
    return new UnsupportedOperationError(message, { cause: error });
  }

  return new DeviceConnectionError(message, { cause: error });
}

export function getSolflareShieldErrorMessage(error: unknown): string {
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

  return 'Solflare Shield request failed.';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
