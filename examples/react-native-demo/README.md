# HWSigner React Native Demo

This is a minimal Expo-style demo app for the React Native entrypoint.

It is intentionally adapter-first:

- Tangem uses an injected Tangem React Native SDK object.
- Keystone uses an injected QR/UR client supplied by the app.
- WalletConnect-backed wallets use an injected Solana wallet client.

The demo does not fake a successful device operation. Until you wire real clients in
`src/configureNativeClients.ts`, the buttons will return explicit configuration errors.

## Run

From this folder:

```bash
npm install
npm run start
```

Before running it against real hardware, build the package at the repo root:

```bash
npm run package:build
```

Then replace the placeholders in `src/configureNativeClients.ts` with your real Tangem,
Keystone QR, or WalletConnect client.
