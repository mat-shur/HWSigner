import {
  AdapterInitializationError,
  DeviceConnectionError,
  DeviceNotFoundError,
  TimeoutError,
  UnsupportedOperationError,
  UserRejectedError,
} from '@/lib/hwsigner/errors';

export function mapTangemError(error: unknown): Error {
  const message = getTangemErrorMessage(error);
  const normalized = message.toLowerCase();
  const name = getTangemErrorName(error);

  if (
    name === 'WalletWindowClosedError'
    || name === 'WalletWindowBlockedError'
    || normalized.includes('cancel')
    || normalized.includes('reject')
    || normalized.includes('decline')
    || normalized.includes('user')
    || normalized.includes('window closed')
    || normalized.includes('modal closed')
  ) {
    return new UserRejectedError(message, { cause: error });
  }

  if (normalized.includes('timeout') || normalized.includes('timed out')) {
    return new TimeoutError(message, { cause: error });
  }

  if (
    normalized.includes('nfc')
    && (normalized.includes('disabled') || normalized.includes('not supported') || normalized.includes('unavailable'))
  ) {
    return new DeviceNotFoundError(message, { cause: error });
  }

  if (
    name === 'WalletConnectFeatureNotSupportedError'
    || normalized.includes('not supported by the wallet')
    || normalized.includes('feature is not supported')
  ) {
    return new UnsupportedOperationError(message, { cause: error });
  }

  if (
    name === 'WalletConfigError'
    || normalized.includes('not initialized')
    || normalized.includes('startsession')
    || normalized.includes('native module')
    || normalized.includes('project id is undefined')
    || normalized.includes('walletconnect project id')
  ) {
    return new AdapterInitializationError(message, { cause: error });
  }

  if (normalized.includes('unsupported') || normalized.includes('not supported')) {
    return new UnsupportedOperationError(message, { cause: error });
  }

  return new DeviceConnectionError(message, { cause: error });
}

export function getTangemErrorMessage(error: unknown): string {
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

    if (typeof error.localizedDescription === 'string' && error.localizedDescription) {
      return error.localizedDescription;
    }
  }

  return 'Tangem NFC request failed.';
}

function getTangemErrorName(error: unknown): string {
  if (error instanceof Error && error.name) {
    return error.name;
  }

  if (isRecord(error)) {
    if (typeof error.name === 'string' && error.name) {
      return error.name;
    }

    if (error.error instanceof Error && error.error.name) {
      return error.error.name;
    }
  }

  return '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
