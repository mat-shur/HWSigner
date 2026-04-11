import { DeviceManagementKitBuilder } from '@ledgerhq/device-management-kit';
import { SignMessageVersion, SignerSolanaBuilder } from '@ledgerhq/device-signer-kit-solana';
import { speculosIdentifier, speculosTransportFactory } from '@ledgerhq/device-transport-kit-speculos';
import { firstValueFrom, timeout } from 'rxjs';

const speculosUrl = process.env.LEDGER_SPECULOS_URL || 'http://127.0.0.1:5000';
const derivationPath = "m/44'/501'/0'/0'";
const message = new TextEncoder().encode('HWSigner Speculos smoke test');

const dmk = new DeviceManagementKitBuilder().addTransport(speculosTransportFactory(speculosUrl)).build();

try {
  const device = await firstValueFrom(
    dmk.startDiscovering({ transport: speculosIdentifier }).pipe(
      timeout({
        first: 5000,
      }),
    ),
  );

  const sessionId = await dmk.connect({
    device,
    sessionRefresherOptions: {
      isRefresherDisabled: true,
    },
  });

  const signer = new SignerSolanaBuilder({
    dmk,
    sessionId,
    originToken: 'HWSigner smoke',
  }).build();

  const address = await runAction(signer.getAddress(derivationPath));
  const appConfiguration = await runAction(signer.getAppConfiguration());
  const signedMessage = await runAction(
    signer.signMessage(derivationPath, message, {
      version: SignMessageVersion.Raw,
      skipOpenApp: true,
    }),
  );

  console.log(JSON.stringify({
    speculosUrl,
    address,
    appConfiguration,
    signedMessage,
  }, null, 2));

  await dmk.disconnect({
    sessionId,
  });
} finally {
  dmk.close();
}

function runAction(action) {
  return new Promise((resolve, reject) => {
    const subscription = action.observable.subscribe({
      next: (state) => {
        if (state.status === 'completed') {
          subscription.unsubscribe();
          resolve(state.output);
        }

        if (state.status === 'error') {
          subscription.unsubscribe();
          reject(state.error);
        }
      },
      error: (error) => {
        subscription.unsubscribe();
        reject(error);
      },
    });
  });
}
