'use client';

import {
  AdapterInitializationError,
  DeviceConnectionError,
  HWSignerError,
  UnsupportedOperationError,
  UserRejectedError,
} from '../hwsigner/errors';

export function mapEllipalError(error: unknown): HWSignerError {
  if (error instanceof HWSignerError) {
    return error;
  }

  const message = getEllipalErrorMessage(error);
  const normalized = message.toLowerCase();
  const name = getEllipalErrorName(error);

  if (
    name === 'WalletWindowClosedError'
    || name === 'WalletWindowBlockedError'
    || normalized.includes('modal closed')
    || normalized.includes('window closed')
    || normalized.includes('user rejected')
    || normalized.includes('rejected by user')
    || normalized.includes('pairing rejected')
  ) {
    return new UserRejectedError(message, { cause: error });
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
    || normalized.includes('project id is undefined')
    || normalized.includes('walletconnect project id')
  ) {
    return new AdapterInitializationError(message, { cause: error });
  }

  if (
    name === 'WalletNotReadyError'
    || normalized.includes('not available in this browser')
    || normalized.includes('unsupported')
    || normalized.includes('only run in a browser')
  ) {
    return new UnsupportedOperationError(message, { cause: error });
  }

  if (
    name === 'WalletNotConnectedError'
    || name === 'WalletDisconnectedError'
    || name === 'WalletDisconnectionError'
    || name === 'ClientNotInitializedError'
    || normalized.includes('not connected')
    || normalized.includes('disconnected')
  ) {
    return new DeviceConnectionError(message, { cause: error });
  }

  return new DeviceConnectionError(message, { cause: error });
}

export function getEllipalErrorMessage(error: unknown): string {
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

    if (record.error instanceof Error && record.error.message) {
      return record.error.message;
    }
  }

  return 'ELLIPAL request failed.';
}

function getEllipalErrorName(error: unknown): string {
  if (error instanceof Error && error.name) {
    return error.name;
  }

  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;

    if (typeof record.name === 'string' && record.name) {
      return record.name;
    }

    if (record.error instanceof Error && record.error.name) {
      return record.error.name;
    }
  }

  return '';
}