import {
  DeviceActionStatus,
  UserInteractionRequired,
  type ExecuteDeviceActionReturnType,
} from '@ledgerhq/device-management-kit';

import { DeviceConnectionError, TimeoutError } from '@/lib/hwsigner/errors';
import type { HWSignerEventListener } from '@/lib/hwsigner/types';
import { mapLedgerError } from '@/lib/ledger/error-map';

const USER_INTERACTION_MESSAGES: Partial<Record<UserInteractionRequired, string>> = {
  [UserInteractionRequired.AllowSecureConnection]: 'Allow the secure Ledger connection on the device.',
  [UserInteractionRequired.ConfirmOpenApp]: 'Open the Solana app on the Ledger device.',
  [UserInteractionRequired.None]: 'Ledger request in progress.',
  [UserInteractionRequired.SignPersonalMessage]: 'Approve message signing on the Ledger device.',
  [UserInteractionRequired.SignTransaction]: 'Approve the transaction on the Ledger device.',
  [UserInteractionRequired.UnlockDevice]: 'Unlock the Ledger device to continue.',
  [UserInteractionRequired.VerifyAddress]: 'Verify the address on the Ledger device.',
};

export async function resolveLedgerDeviceAction<
  Output,
  ActionError,
  IntermediateValue extends { requiredUserInteraction?: string; step?: string },
>(
  action: ExecuteDeviceActionReturnType<Output, ActionError, IntermediateValue>,
  options: {
    operation: string;
    onEvent?: HWSignerEventListener;
    timeoutMs?: number;
  },
): Promise<Output> {
  return new Promise<Output>((resolve, reject) => {
    const timeoutMs = options.timeoutMs ?? 120_000;
    let settled = false;
    let lastPendingKey = '';

    const timer = setTimeout(() => {
      action.cancel();
      settleFailure(new TimeoutError(`${options.operation} timed out after ${Math.floor(timeoutMs / 1000)} seconds.`));
    }, timeoutMs);

    const subscription = action.observable.subscribe({
      next: (state) => {
        if (settled) {
          return;
        }

        switch (state.status) {
          case DeviceActionStatus.Pending: {
            const interactionMessage = describeRequiredInteraction(state.intermediateValue.requiredUserInteraction);
            const pendingKey = `${state.intermediateValue.step ?? ''}:${interactionMessage}`;

            if (interactionMessage && pendingKey !== lastPendingKey) {
              lastPendingKey = pendingKey;
              options.onEvent?.({
                type: 'action',
                message: interactionMessage,
                details: state.intermediateValue,
              });
            }
            break;
          }

          case DeviceActionStatus.Completed:
            settleSuccess(state.output);
            break;

          case DeviceActionStatus.Error:
            settleFailure(mapLedgerError(state.error));
            break;

          case DeviceActionStatus.Stopped:
            settleFailure(new DeviceConnectionError(`${options.operation} stopped before completion.`));
            break;

          case DeviceActionStatus.NotStarted:
          default:
            break;
        }
      },
      error: (error) => {
        if (!settled) {
          settleFailure(mapLedgerError(error));
        }
      },
    });

    function settleSuccess(value: Output) {
      settled = true;
      clearTimeout(timer);
      subscription.unsubscribe();
      resolve(value);
    }

    function settleFailure(error: Error) {
      settled = true;
      clearTimeout(timer);
      subscription.unsubscribe();
      reject(error);
    }
  });
}

function describeRequiredInteraction(requiredUserInteraction?: string): string | null {
  if (!requiredUserInteraction) {
    return null;
  }

  return USER_INTERACTION_MESSAGES[requiredUserInteraction as UserInteractionRequired] ?? 'Continue on the Ledger device.';
}
