'use client';

import { UnknownWalletError } from './errors';
import type { CreateHWSignerOptions, WalletAdapter } from './types';
import { createArculusAdapter } from '../arculus/adapter';
import { createBcVaultAdapter } from '../bc-vault/adapter';
import { createCoolWalletAdapter } from '../coolwallet/adapter';
import { createCypherockAdapter } from '../cypherock/adapter';
import { createDcentAdapter } from '../dcent/adapter';
import { createEllipalAdapter } from '../ellipal/adapter';
import { createGridPlusAdapter } from '../gridplus/adapter';
import { createKeyPalAdapter } from '../keypal/adapter';
import { createKeystoneAdapter } from '../keystone/adapter';
import { createLedgerAdapter } from '../ledger/adapter';
import { createOneKeyAdapter } from '../onekey/adapter';
import { createSafePalAdapter } from '../safepal/adapter';
import { createSecuXAdapter } from '../secux/adapter';
import { createSolflareShieldAdapter } from '../solflare-shield/adapter';
import { createTangemAdapter } from '../tangem/adapter';
import { createTrezorAdapter } from '../trezor/adapter';

export function createHWSigner(options: CreateHWSignerOptions): WalletAdapter {
  switch (options.walletId) {
    case 'arculus':
      return createArculusAdapter(options.runtime, options.onEvent);
    case 'bc-vault':
      return createBcVaultAdapter(options.runtime, options.onEvent);
    case 'ledger':
      return createLedgerAdapter(options.runtime, options.onEvent);
    case 'coolwallet':
      return createCoolWalletAdapter(options.runtime, options.onEvent);
    case 'cypherock':
      return createCypherockAdapter(options.runtime, options.onEvent);
    case 'dcent':
      return createDcentAdapter(options.runtime, options.onEvent);
    case 'ellipal':
      return createEllipalAdapter(options.runtime, options.onEvent);
    case 'gridplus-lattice':
      return createGridPlusAdapter(options.runtime, options.onEvent);
    case 'keypal':
      return createKeyPalAdapter(options.runtime, options.onEvent);
    case 'keystone':
      return createKeystoneAdapter(options.runtime, options.onEvent);
    case 'onekey':
      return createOneKeyAdapter(options.runtime, options.onEvent);
    case 'safepal':
      return createSafePalAdapter(options.runtime, options.onEvent);
    case 'secux':
      return createSecuXAdapter(options.runtime, options.onEvent);
    case 'solflare-shield':
      return createSolflareShieldAdapter(options.runtime, options.onEvent);
    case 'tangem':
      return createTangemAdapter(options.runtime, options.onEvent);
    case 'trezor':
      return createTrezorAdapter(options.runtime, options.onEvent);
    default:
      throw new UnknownWalletError(options.walletId);
  }
}