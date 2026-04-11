'use client';

import { UnknownWalletError } from '@/lib/hwsigner/errors';
import type { CreateHWSignerOptions, WalletAdapter } from '@/lib/hwsigner/types';
import { createArculusAdapter } from '@/lib/arculus/adapter';
import { createBcVaultAdapter } from '@/lib/bc-vault/adapter';
import { createCoolWalletAdapter } from '@/lib/coolwallet/adapter';
import { createCypherockAdapter } from '@/lib/cypherock/adapter';
import { createDcentAdapter } from '@/lib/dcent/adapter';
import { createEllipalAdapter } from '@/lib/ellipal/adapter';
import { createGridPlusAdapter } from '@/lib/gridplus/adapter';
import { createKeyPalAdapter } from '@/lib/keypal/adapter';
import { createKeystoneAdapter } from '@/lib/keystone/adapter';
import { createLedgerAdapter } from '@/lib/ledger/adapter';
import { createOneKeyAdapter } from '@/lib/onekey/adapter';
import { createSafePalAdapter } from '@/lib/safepal/adapter';
import { createSecuXAdapter } from '@/lib/secux/adapter';
import { createSolflareShieldAdapter } from '@/lib/solflare-shield/adapter';
import { createTangemAdapter } from '@/lib/tangem/adapter';
import { createTrezorAdapter } from '@/lib/trezor/adapter';

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
