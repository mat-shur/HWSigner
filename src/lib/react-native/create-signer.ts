import { UnsupportedOperationError } from '@/lib/hwsigner/errors';
import type { CreateHWSignerOptions, WalletAdapter } from '@/lib/hwsigner/types';
import { createTangemReactNativeAdapter } from '@/lib/tangem/react-native-adapter';
import { createReactNativeKeystoneQrAdapter } from '@/lib/react-native/keystone-qr-adapter';
import { createReactNativeWalletConnectAdapter } from '@/lib/react-native/walletconnect-adapter';
import { getReactNativeWalletSupport } from '@/lib/react-native/support';

export function createReactNativeHWSigner(options: CreateHWSignerOptions): WalletAdapter {
  if (options.runtime.kind === 'react-native-keystone-qr') {
    return createReactNativeKeystoneQrAdapter(options.walletId, options.runtime, options.onEvent);
  }

  if (options.runtime.kind === 'react-native-walletconnect') {
    return createReactNativeWalletConnectAdapter(options.walletId, options.runtime, options.onEvent);
  }

  if (options.walletId === 'tangem') {
    return createTangemReactNativeAdapter(options.runtime, options.onEvent);
  }

  const support = getReactNativeWalletSupport(options.walletId);
  throw new UnsupportedOperationError(
    `${options.walletId} is not implemented in the React Native entrypoint yet. ${support.note}`,
  );
}
