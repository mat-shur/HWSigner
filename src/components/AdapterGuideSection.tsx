import { motion } from 'framer-motion';
import CodeBlock from '@/components/CodeBlock';
import { Boxes, CheckCircle2, FileCheck2, GitBranch, PlugZap, ShieldAlert } from 'lucide-react';

const adapterSteps = [
  {
    icon: GitBranch,
    title: '1. Choose the Runtime',
    desc: 'Start from the real integration path: WebHID, WebUSB, Web BLE, WalletConnect, injected provider, QR, Speculos, React Native WalletConnect, or native React Native NFC.',
  },
  {
    icon: PlugZap,
    title: '2. Wrap the Vendor SDK',
    desc: 'Keep wallet-specific code inside `src/lib/<wallet>/client.ts`. Normalize addresses, signatures, and Solana transaction objects at the boundary.',
  },
  {
    icon: Boxes,
    title: '3. Expose the Adapter',
    desc: 'Implement the shared `WalletAdapter` methods so app code keeps calling `connect`, `getAccounts`, `signMessage`, and transaction signing consistently.',
  },
  {
    icon: ShieldAlert,
    title: '4. Be Honest About Support',
    desc: 'If the wallet cannot sign messages, versioned transactions, or run in the browser, return a disabled capability or throw `UnsupportedOperationError`.',
  },
  {
    icon: FileCheck2,
    title: '5. Add the UI Contract',
    desc: 'Register the wallet in `src/data/wallets.ts`, wire the runtime in `PlaygroundSection`, and add focused tests for capabilities and error mapping.',
  },
];

const adapterRules = [
  'Do not simulate successful hardware operations.',
  'Use native `@solana/web3.js` Transaction and VersionedTransaction inputs.',
  'Map vendor errors into HWSigner errors before they reach the UI.',
  'Keep browser-only SDKs behind dynamic client imports.',
  'Use the React Native entrypoint for native NFC/BLE/USB runtimes and injected Solana WalletConnect clients.',
  'Gate local/dev-only runtimes with explicit env flags.',
  'Prefer one small adapter per wallet instead of global wallet-specific branches.',
];

const integrationTypes = [
  { label: 'Direct Device', value: 'Ledger WebHID, OneKey WebUSB, CoolWallet Web BLE' },
  { label: 'Bridge App', value: 'Trezor Connect, BC Vault Desktop, GridPlus via NuFi' },
  { label: 'Mobile / QR', value: "Keystone QR, D'CENT, ELLIPAL, Arculus, BC Vault, Tangem WalletConnect" },
  { label: 'React Native Entry', value: 'createReactNativeHWSigner -> Tangem NFC, Keystone QR, and injected Solana WalletConnect clients' },
];

const codeSnippet = `// 1. Add a runtime shape in src/lib/hwsigner/types.ts
type HWSignerRuntime =
  | { kind: 'my-wallet-webusb'; transport: 'webusb' }
  | ExistingRuntimes;

// 2. Implement a small adapter wrapper
export function createMyWalletAdapter(
  runtime: HWSignerRuntime,
  onEvent?: HWSignerEventListener,
): WalletAdapter {
  if (runtime.kind !== 'my-wallet-webusb') {
    throw new UnsupportedOperationError('MyWallet only supports WebUSB.');
  }

  return new MyWalletAdapter(new MyWalletClient(onEvent));
}

// 3. Keep app code unchanged
const signer = createHWSigner({
  walletId: 'my-wallet',
  runtime: { kind: 'my-wallet-webusb', transport: 'webusb' },
});

const connection = await signer.connect();
const [account] = await signer.getAccounts({ startIndex: 0, count: 1 });
const signed = await signer.signTransaction({ transaction, derivationPath: account.path });`;

export default function AdapterGuideSection() {
  return (
    <section className="relative py-24 lg:py-32" id="adapter-guide">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-primary text-xs font-mono uppercase tracking-widest mb-3">Adapter Guide</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">How to add a new wallet</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm">
            HWSigner keeps every hardware wallet behind one adapter contract. New wallets plug into the runtime layer without changing application code.
          </p>
        </motion.div>

        <div className="max-w-6xl mx-auto grid gap-6 lg:grid-cols-[1fr,0.95fr]">
          <motion.div
            initial={{ opacity: 0, x: -18 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-3"
          >
            {adapterSteps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.04 }}
                className="rounded-xl border border-border bg-card p-4 hover:border-primary/20 transition-colors"
              >
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10">
                    <step.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{step.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 18 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-4"
          >
            <CodeBlock code={codeSnippet} filename="adapter-template.ts" maxHeightClassName="max-h-[420px]" />

            <div className="grid gap-3 sm:grid-cols-2">
              {integrationTypes.map((item) => (
                <div key={item.label} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-primary">{item.label}</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-success/20 bg-success/5 p-4">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <p className="text-sm font-semibold">Adapter checklist</p>
              </div>
              <div className="grid gap-2">
                {adapterRules.map((rule) => (
                  <div key={rule} className="flex gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-success" />
                    <span>{rule}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
