export type HWSignerErrorCode =
  | 'USER_REJECTED'
  | 'DEVICE_NOT_FOUND'
  | 'DEVICE_CONNECTION'
  | 'UNSUPPORTED_OPERATION'
  | 'INVALID_DERIVATION_PATH'
  | 'INVALID_TRANSACTION'
  | 'TIMEOUT'
  | 'ADAPTER_INITIALIZATION'
  | 'UNKNOWN_WALLET';

export class HWSignerError extends Error {
  readonly code: HWSignerErrorCode;
  readonly cause?: unknown;
  readonly details?: unknown;

  constructor(
    code: HWSignerErrorCode,
    message: string,
    options?: { cause?: unknown; details?: unknown },
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.cause = options?.cause;
    this.details = options?.details;
  }
}

export function isHWSignerError(error: unknown): error is HWSignerError {
  return error instanceof HWSignerError;
}

export class UserRejectedError extends HWSignerError {
  constructor(message = 'The request was rejected on the device.', options?: { cause?: unknown; details?: unknown }) {
    super('USER_REJECTED', message, options);
  }
}

export class DeviceNotFoundError extends HWSignerError {
  constructor(message = 'No compatible hardware wallet was found.', options?: { cause?: unknown; details?: unknown }) {
    super('DEVICE_NOT_FOUND', message, options);
  }
}

export class DeviceConnectionError extends HWSignerError {
  constructor(message = 'Could not connect to the hardware wallet.', options?: { cause?: unknown; details?: unknown }) {
    super('DEVICE_CONNECTION', message, options);
  }
}

export class UnsupportedOperationError extends HWSignerError {
  constructor(message = 'This operation is not supported by the selected wallet runtime.', options?: { cause?: unknown; details?: unknown }) {
    super('UNSUPPORTED_OPERATION', message, options);
  }
}

export class InvalidDerivationPathError extends HWSignerError {
  constructor(message = 'The derivation path is invalid.', options?: { cause?: unknown; details?: unknown }) {
    super('INVALID_DERIVATION_PATH', message, options);
  }
}

export class InvalidTransactionError extends HWSignerError {
  constructor(message = 'The transaction payload is invalid.', options?: { cause?: unknown; details?: unknown }) {
    super('INVALID_TRANSACTION', message, options);
  }
}

export class TimeoutError extends HWSignerError {
  constructor(message = 'The hardware wallet operation timed out.', options?: { cause?: unknown; details?: unknown }) {
    super('TIMEOUT', message, options);
  }
}

export class AdapterInitializationError extends HWSignerError {
  constructor(message = 'The wallet adapter could not be initialized.', options?: { cause?: unknown; details?: unknown }) {
    super('ADAPTER_INITIALIZATION', message, options);
  }
}

export class UnknownWalletError extends HWSignerError {
  constructor(walletId: string, options?: { cause?: unknown; details?: unknown }) {
    super('UNKNOWN_WALLET', `Wallet "${walletId}" is not implemented yet.`, options);
  }
}

export function getErrorMessage(error: unknown): string {
  for (const candidate of iterateErrorChain(error)) {
    if (candidate instanceof Error && candidate.message) {
      return candidate.message;
    }

    if (typeof candidate === 'string') {
      return candidate;
    }

    if (isRecord(candidate) && typeof candidate.message === 'string' && candidate.message) {
      return candidate.message;
    }
  }

  return 'Unknown hardware wallet error';
}

export function getErrorCode(error: unknown): string | null {
  for (const candidate of iterateErrorChain(error)) {
    if (isRecord(candidate) && ('errorCode' in candidate || 'statusCode' in candidate)) {
      const raw = candidate.errorCode ?? candidate.statusCode;

      if (typeof raw === 'number' || typeof raw === 'string') {
        return String(raw).toLowerCase();
      }
    }
  }

  return null;
}

export function getErrorTag(error: unknown): string | null {
  for (const candidate of iterateErrorChain(error)) {
    if (isRecord(candidate) && typeof candidate._tag === 'string' && candidate._tag) {
      return candidate._tag;
    }
  }

  return null;
}

export function toErrorPayload(error: unknown): {
  code: HWSignerErrorCode | 'DEVICE_CONNECTION';
  message: string;
  details?: unknown;
} {
  if (isHWSignerError(error)) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  const details =
    isRecord(error) && 'details' in error
      ? error.details
      : undefined;

  return {
    code: 'DEVICE_CONNECTION',
    message: getErrorMessage(error),
    details,
  };
}

export function getHttpStatusForErrorCode(code: HWSignerErrorCode | 'DEVICE_CONNECTION'): number {
  switch (code) {
    case 'USER_REJECTED':
      return 409;
    case 'DEVICE_NOT_FOUND':
      return 404;
    case 'UNSUPPORTED_OPERATION':
      return 403;
    case 'INVALID_DERIVATION_PATH':
    case 'INVALID_TRANSACTION':
      return 400;
    case 'TIMEOUT':
      return 504;
    case 'ADAPTER_INITIALIZATION':
    case 'DEVICE_CONNECTION':
    case 'UNKNOWN_WALLET':
    default:
      return 500;
  }
}

function *iterateErrorChain(error: unknown): Generator<unknown> {
  const queue: unknown[] = [error];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const candidate = queue.shift();
    if (candidate === undefined || candidate === null || seen.has(candidate)) {
      continue;
    }

    seen.add(candidate);
    yield candidate;

    if (isRecord(candidate)) {
      if ('originalError' in candidate) {
        queue.push(candidate.originalError);
      }

      if ('details' in candidate) {
        queue.push(candidate.details);
      }

      if ('cause' in candidate) {
        queue.push(candidate.cause);
      }

      if ('error' in candidate) {
        queue.push(candidate.error);
      }
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
