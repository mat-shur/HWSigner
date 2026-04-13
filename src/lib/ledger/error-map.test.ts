import { NoAccessibleDeviceError, RefusedByUserDAError } from '@ledgerhq/device-management-kit';
import { WebHidTransportNotSupportedError } from '@ledgerhq/device-transport-kit-web-hid';
import { describe, expect, it } from 'vitest';

import {
  DeviceConnectionError,
  DeviceNotFoundError,
  TimeoutError,
  UnsupportedOperationError,
  UserRejectedError,
} from '../hwsigner/errors';
import { mapLedgerError } from './error-map';

describe('Ledger error mapping', () => {
  it('maps missing devices into DeviceNotFoundError', () => {
    expect(mapLedgerError(new NoAccessibleDeviceError('missing device'))).toBeInstanceOf(DeviceNotFoundError);
  });

  it('maps explicit user rejection into UserRejectedError', () => {
    expect(mapLedgerError(new RefusedByUserDAError('rejected'))).toBeInstanceOf(UserRejectedError);
    expect(mapLedgerError({ errorCode: 6982, message: 'Canceled by user' })).toBeInstanceOf(UserRejectedError);
  });

  it('maps timeout-style Ledger tags into TimeoutError', () => {
    expect(mapLedgerError({ _tag: 'SendCommandTimeoutError', message: 'timeout' })).toBeInstanceOf(TimeoutError);
  });

  it('maps unsupported WebHID runtimes into UnsupportedOperationError', () => {
    expect(mapLedgerError(new WebHidTransportNotSupportedError('unsupported'))).toBeInstanceOf(UnsupportedOperationError);
  });

  it('keeps unknown ledger device-action errors as generic device connection failures', () => {
    expect(mapLedgerError({
      _tag: 'UnknownDAError',
      originalError: {
        _tag: 'SolanaAppCommandError',
        errorCode: '6a81',
        message: 'Invalid off-chain message header',
      },
    })).toBeInstanceOf(DeviceConnectionError);
  });
});