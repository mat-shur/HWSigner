import { describe, expect, it } from 'vitest';

import { getErrorCode, getErrorMessage, getErrorTag } from '@/lib/hwsigner/errors';

describe('error helpers', () => {
  it('extracts nested originalError messages', () => {
    expect(getErrorMessage({
      _tag: 'UnknownDAError',
      originalError: new Error('Nested Ledger failure'),
    })).toBe('Nested Ledger failure');
  });

  it('extracts nested Ledger command error codes', () => {
    expect(getErrorCode({
      _tag: 'UnknownDAError',
      originalError: {
        errorCode: '6A81',
        message: 'Invalid off-chain message header',
      },
    })).toBe('6a81');
  });

  it('extracts Ledger command error codes stored in details', () => {
    expect(getErrorCode({
      message: 'Wrapped',
      details: {
        errorCode: '6A80',
      },
    })).toBe('6a80');
  });

  it('extracts nested Ledger tags', () => {
    expect(getErrorTag({
      details: {
        _tag: 'SolanaAppCommandError',
      },
    })).toBe('SolanaAppCommandError');
  });
});
