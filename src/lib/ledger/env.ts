export const DEFAULT_SPECULOS_URL = 'http://127.0.0.1:5000';
export const DEFAULT_SPECULOS_API_BASE_URL = '/api/ledger/speculos';

export function resolveSpeculosEnabled(
  env: Partial<Pick<NodeJS.ProcessEnv, 'NODE_ENV' | 'NEXT_PUBLIC_ENABLE_SPECULOS'>> = process.env,
): boolean {
  const flag = env.NEXT_PUBLIC_ENABLE_SPECULOS?.trim().toLowerCase();

  if (flag === 'true') {
    return true;
  }

  if (flag === 'false') {
    return false;
  }

  return env.NODE_ENV !== 'production';
}

export function isSpeculosEnabled(): boolean {
  return resolveSpeculosEnabled(process.env);
}

export function resolveSpeculosUrl(value?: string): string {
  return value?.trim() || process.env.LEDGER_SPECULOS_URL || DEFAULT_SPECULOS_URL;
}
