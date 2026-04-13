import type { ReactNativeSolanaWalletClient, TangemReactNativeSdk } from 'hwsigner/react-native';

export const tangemSdk: TangemReactNativeSdk | null = null;
export const keystoneQrClient: ReactNativeSolanaWalletClient | null = null;
export const walletConnectClient: ReactNativeSolanaWalletClient | null = null;

export function requireConfiguredClient<T>(client: T | null, label: string): T {
  if (!client) {
    throw new Error(`${label} is not configured. Wire the real native client before running this flow.`);
  }

  return client;
}
