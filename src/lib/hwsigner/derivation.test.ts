import { describe, expect, it } from 'vitest';

import {
  assertValidSolanaDerivationPath,
  formatLedgerSolanaDerivationPath,
  formatSolanaDerivationPath,
  getSolanaDerivationPaths,
  parseSolanaDerivationPath,
  toLedgerDerivationPath,
} from './derivation';
import { InvalidDerivationPathError } from './errors';

describe('derivation helpers', () => {
  it('formats the standard Ledger Solana derivation path', () => {
    expect(formatSolanaDerivationPath(3)).toBe("m/44'/501'/3'/0'");
    expect(formatLedgerSolanaDerivationPath(3)).toBe("44'/501'/3'/0'");
  });

  it('parses and normalizes supported Ledger derivation paths', () => {
    expect(parseSolanaDerivationPath("44'/501'/7'/0'")).toEqual({
      accountIndex: 7,
      change: 0,
      normalizedPath: "m/44'/501'/7'/0'",
    });
  });

  it('builds multiple sequential derivation paths', () => {
    expect(getSolanaDerivationPaths(2, 3)).toEqual([
      "m/44'/501'/2'/0'",
      "m/44'/501'/3'/0'",
      "m/44'/501'/4'/0'",
    ]);
  });

  it('converts UI derivation paths into Ledger SDK format', () => {
    expect(toLedgerDerivationPath("m/44'/501'/9'/0'")).toBe("44'/501'/9'/0'");
    expect(toLedgerDerivationPath("44'/501'/9'/0'")).toBe("44'/501'/9'/0'");
  });

  it('rejects invalid derivation paths', () => {
    expect(() => assertValidSolanaDerivationPath("m/44/501'/0'/0'")).toThrow(InvalidDerivationPathError);
    expect(() => assertValidSolanaDerivationPath("m/44'/501'/x'/0'")).toThrow(InvalidDerivationPathError);
  });
});