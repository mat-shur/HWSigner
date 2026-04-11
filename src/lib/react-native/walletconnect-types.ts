import type { Transaction, VersionedTransaction } from '@solana/web3.js';

export type ReactNativePublicKeyLike =
  | string
  | {
      toBase58?: () => string;
      toString?: () => string;
      toBytes?: () => Uint8Array;
    };

export type ReactNativeWalletSignature =
  | string
  | Uint8Array
  | ArrayBuffer
  | number[]
  | {
      signature?: ReactNativeWalletSignature;
      data?: ReactNativeWalletSignature;
    };

export interface ReactNativeSolanaWalletClient {
  publicKey?: ReactNativePublicKeyLike | null;
  connect: () => Promise<unknown>;
  disconnect?: () => Promise<unknown>;
  signMessage?: (message: Uint8Array) => Promise<ReactNativeWalletSignature>;
  signTransaction?: <T extends Transaction | VersionedTransaction>(transaction: T) => Promise<T>;
}
