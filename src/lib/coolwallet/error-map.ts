import {
  AdapterInitializationError,
  DeviceConnectionError,
  DeviceNotFoundError,
  UnsupportedOperationError,
  UserRejectedError,
} from '@/lib/hwsigner/errors';

export function mapCoolWalletError(error: unknown): Error {
  const message = getCoolWalletErrorMessage(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes('cancel')
    || normalized.includes('rejected')
    || normalized.includes('denied')
    || normalized.includes('closed')
  ) {
    return new UserRejectedError(message, { cause: error });
  }

  if (
    normalized.includes('bluetooth')
    || normalized.includes('notfounderror')
    || normalized.includes('no compatible device')
    || normalized.includes('device not found')
    || normalized.includes('not available in this browser')
  ) {
    return new DeviceNotFoundError(message, { cause: error });
  }

  if (
    normalized.includes('register')
    || normalized.includes('appid')
    || normalized.includes('pair password')
    || normalized.includes('pairing password')
    || normalized.includes('initialization')
    || normalized.includes('not initialized')
  ) {
    return new AdapterInitializationError(message, { cause: error });
  }

  if (
    normalized.includes('legacy-message-bytes')
    || normalized.includes('versioned-message-bytes')
    || normalized.includes('utf-8')
    || normalized.includes('not supported')
  ) {
    return new UnsupportedOperationError(message, { cause: error });
  }

  return new DeviceConnectionError(message, { cause: error });
}

export function getCoolWalletErrorMessage(error: unknown): string {
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

    if (typeof error.msg === 'string' && error.msg) {
      return error.msg;
    }

    if (typeof error.error === 'string' && error.error) {
      return error.error;
    }

    if (typeof error.statusCode === 'string' && error.statusCode) {
      return error.statusCode;
    }
  }

  return 'CoolWallet request failed.';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
