import {
  AdapterInitializationError,
  DeviceConnectionError,
  DeviceNotFoundError,
  UnsupportedOperationError,
  UserRejectedError,
} from '../hwsigner/errors';

export function mapGridPlusError(error: unknown): Error {
  const message = getGridPlusErrorMessage(error);
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
    normalized.includes('not ready')
    || normalized.includes('not detected')
    || normalized.includes('not installed')
    || normalized.includes('walletnotready')
    || normalized.includes('nufi')
  ) {
    return new DeviceNotFoundError(message, { cause: error });
  }

  if (
    normalized.includes('not initialized')
    || normalized.includes('provider')
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

export function getGridPlusErrorMessage(error: unknown): string {
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

  return 'NuFi is not available yet. Install and unlock the NuFi extension, then configure a GridPlus Lattice1-backed Solana account before connecting.';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
