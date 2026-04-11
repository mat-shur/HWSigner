import { motion } from 'framer-motion';
import CodeBlock from '@/components/CodeBlock';
import { Code2, Puzzle, Monitor, Layers, Boxes, Zap } from 'lucide-react';

const strengths = [
  { icon: Code2, title: 'One API Surface', desc: 'A single interface for all hardware wallets. No wallet-specific code in your app.' },
  { icon: Puzzle, title: 'Capability-Aware', desc: 'Adapters report supported features at runtime. Build UIs that adapt to each device.' },
  { icon: Monitor, title: 'Emulator-Friendly', desc: 'Use emulators and vendor bridge runtimes where wallets expose them, while keeping real-device paths explicit.' },
  { icon: Layers, title: 'Adapter Model', desc: 'Each wallet is a self-contained adapter. Add support for new wallets without touching the core.' },
  { icon: Boxes, title: 'Package-First', desc: 'Designed as a composable package. Tree-shakeable, typed, and framework-agnostic.' },
  { icon: Zap, title: 'Future Extensible', desc: 'Architecture supports QR, NFC, and BLE transports. New wallets plug in cleanly.' },
];

const codeSnippet = `import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { createHWSigner } from '@/lib/hwsigner/create-signer';

const signer = createHWSigner({
  walletId: 'ledger',
  runtime: { kind: 'real-device', transport: 'webhid' },
});

await signer.connect();
const [account] = await signer.getAccounts({ startIndex: 0, count: 1 });

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const { blockhash } = await connection.getLatestBlockhash();

const transaction = new Transaction({
  feePayer: new PublicKey(account.address),
  recentBlockhash: blockhash,
}).add(
  SystemProgram.transfer({
    fromPubkey: new PublicKey(account.address),
    toPubkey: new PublicKey('DRpbCBMxVnDK7maPMoGQfFiRLNGhFM1M7J9sX9g3BJ2j'),
    lamports: 1500000,
  }),
);

const signed = await signer.signTransaction({
  derivationPath: account.path,
  transaction,
});

console.log(signed.signature);`;

export default function DeveloperSection() {
  return (
    <section className="relative py-24 lg:py-32" id="developer">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} className="text-center mb-16">
          <p className="text-primary text-xs font-mono uppercase tracking-widest mb-3">Developer Experience</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Built for developers</h2>
          <p className="text-muted-foreground max-w-lg mx-auto text-sm">
            Clean API, typed responses, and a development-friendly adapter model.
          </p>
        </motion.div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Code */}
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}>
            <CodeBlock code={codeSnippet} filename="example.ts" maxHeightClassName="max-h-[560px]" />
          </motion.div>

          {/* Strengths */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {strengths.map((s, i) => (
              <motion.div key={s.title} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                className="p-4 rounded-xl border border-border bg-card hover:border-primary/20 transition-all">
                <s.icon className="h-4 w-4 text-primary mb-2" />
                <h3 className="text-xs font-semibold mb-1">{s.title}</h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
