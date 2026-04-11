import { InvalidDerivationPathError } from '@/lib/hwsigner/errors';

export const SOLANA_PURPOSE = 44;
export const SOLANA_COIN_TYPE = 501;
export const SOLANA_DEFAULT_CHANGE = 0;

type ParsedSegment = {
  value: number;
  hardened: boolean;
};

export interface ParsedSolanaDerivationPath {
  accountIndex: number;
  change: number;
  normalizedPath: string;
}

export function formatLedgerSolanaDerivationPath(accountIndex: number, change = SOLANA_DEFAULT_CHANGE): string {
  assertValidIndex(accountIndex, 'account index');
  assertValidIndex(change, 'change index');

  return `${SOLANA_PURPOSE}'/${SOLANA_COIN_TYPE}'/${accountIndex}'/${change}'`;
}

export function formatSolanaDerivationPath(accountIndex: number, change = SOLANA_DEFAULT_CHANGE): string {
  return `m/${formatLedgerSolanaDerivationPath(accountIndex, change)}`;
}

export function parseSolanaDerivationPath(path: string): ParsedSolanaDerivationPath {
  const sanitized = path.trim();
  const withoutPrefix = sanitized.startsWith('m/') ? sanitized.slice(2) : sanitized;
  const segments = withoutPrefix.split('/').filter(Boolean).map(parseSegment);

  if (segments.length !== 3 && segments.length !== 4) {
    throw new InvalidDerivationPathError(`Expected 3 or 4 path segments, received "${path}".`);
  }

  const [purpose, coinType, account, change] = segments;

  if (purpose.value !== SOLANA_PURPOSE || !purpose.hardened) {
    throw new InvalidDerivationPathError(`Expected purpose ${SOLANA_PURPOSE}' in "${path}".`);
  }

  if (coinType.value !== SOLANA_COIN_TYPE || !coinType.hardened) {
    throw new InvalidDerivationPathError(`Expected coin type ${SOLANA_COIN_TYPE}' in "${path}".`);
  }

  if (!account.hardened) {
    throw new InvalidDerivationPathError('The Solana account segment must be hardened.');
  }

  if (change && !change.hardened) {
    throw new InvalidDerivationPathError('The Solana change segment must be hardened.');
  }

  return {
    accountIndex: account.value,
    change: change?.value ?? SOLANA_DEFAULT_CHANGE,
    normalizedPath: formatSolanaDerivationPath(account.value, change?.value ?? SOLANA_DEFAULT_CHANGE),
  };
}

export function assertValidSolanaDerivationPath(path: string): string {
  return parseSolanaDerivationPath(path).normalizedPath;
}

export function getSolanaDerivationPaths(startIndex: number, count: number): string[] {
  assertValidIndex(startIndex, 'start index');
  assertValidIndex(count, 'count');

  if (count < 1) {
    throw new InvalidDerivationPathError('At least one account must be requested.');
  }

  return Array.from({ length: count }, (_, offset) => formatSolanaDerivationPath(startIndex + offset));
}

export function resolveDerivationPath(input?: { derivationPath?: string; accountIndex?: number }): string {
  if (input?.derivationPath) {
    return assertValidSolanaDerivationPath(input.derivationPath);
  }

  return formatSolanaDerivationPath(input?.accountIndex ?? 0);
}

export function toLedgerDerivationPath(path: string): string {
  const parsed = parseSolanaDerivationPath(path);
  return formatLedgerSolanaDerivationPath(parsed.accountIndex, parsed.change);
}

function parseSegment(segment: string): ParsedSegment {
  const hardened = segment.endsWith("'");
  const raw = hardened ? segment.slice(0, -1) : segment;

  if (!/^\d+$/.test(raw)) {
    throw new InvalidDerivationPathError(`Invalid derivation path segment "${segment}".`);
  }

  const value = Number(raw);
  assertValidIndex(value, `segment "${segment}"`);

  return { value, hardened };
}

function assertValidIndex(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new InvalidDerivationPathError(`Invalid ${label}: ${value}.`);
  }
}
