import { motion } from 'framer-motion';
import { Link2, GitFork, PenTool, FileText, Settings, MonitorSmartphone, Plug, Eye } from 'lucide-react';

const features = [
  {
    icon: Link2,
    title: 'Connect Wallets',
    desc: 'Unified connect flow across the transport methods each adapter actually supports.',
  },
  { icon: GitFork, title: 'Derive Accounts', desc: 'Standard Solana derivation paths with multi-account support.' },
  { icon: PenTool, title: 'Sign Transactions', desc: 'Sign legacy and versioned transactions with hardware confirmation.' },
  { icon: FileText, title: 'Sign Messages', desc: 'Arbitrary message signing with on-device approval.' },
  { icon: Eye, title: 'Capability Awareness', desc: 'Query what each wallet adapter supports at runtime.' },
  { icon: MonitorSmartphone, title: 'Emulator Support', desc: 'Use emulator and vendor bridge runtimes where wallets expose them, without pretending every wallet has one.' },
  { icon: Plug, title: 'Adapter Architecture', desc: 'Pluggable adapters - add any wallet without changing the API.' },
  { icon: Settings, title: 'One API Surface', desc: 'Single consistent interface regardless of the underlying wallet.' },
];

export default function CapabilitiesSection() {
  return (
    <section className="relative py-24 lg:py-32" id="features">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-primary text-xs font-mono uppercase tracking-widest mb-3">Package Capabilities</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">What the SDK provides</h2>
          <p className="text-muted-foreground max-w-lg mx-auto text-sm">
            A single package to abstract every hardware wallet behind a unified, capability-aware API.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="group p-5 rounded-xl border border-border bg-card hover:border-primary/20 hover:bg-surface-2 transition-all duration-300"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/10 mb-4 group-hover:bg-primary/15 transition-colors">
                <feature.icon className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-sm font-semibold mb-1.5">{feature.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
