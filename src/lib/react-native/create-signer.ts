import { UnsupportedOperationError } from '../hwsigner/errors';
import type { CreateHWSignerOptions, WalletAdapter } from '../hwsigner/types';
import { createTangemReactNativeAdapter } from '../tangem/react-native-adapter';
import { createReactNativeKeystoneQrAdapter } from './keystone-qr-adapter';
import { createReactNativeWalletConnectAdapter } from './walletconnect-adapter';
import { getReactNativeWalletSupport } from './support';

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