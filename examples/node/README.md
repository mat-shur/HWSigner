# HWSigner Node Examples

These examples are intentionally small and do not mock hardware wallet approvals.

Run from the repository root:

```bash
npm run package:build
node examples/node/build-transfer.mjs
```

For the local Ledger Speculos bridge example, start Speculos and the Next.js dev server first:

```bash
NEXT_PUBLIC_ENABLE_SPECULOS=true npm run dev
node examples/node/speculos-sign-message.mjs "hello from node"
```

The Speculos script talks to the local Next route handlers at `http://localhost:3000/api/ledger/speculos`.
It will fail if Speculos is not running or the Solana app is not available in the emulator.
