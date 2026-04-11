import { motion } from 'framer-motion';
import { ArrowRight, Layers, Box, Cpu, Radio } from 'lucide-react';

const badges = [
  { label: 'React Native', icon: Box },
  { label: 'Solana', icon: Layers },
  { label: 'Hardware Wallets', icon: Cpu },
  { label: 'Adapter-based', icon: Radio },
];

export default function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-14">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />

      <div className="relative container mx-auto px-4 lg:px-8 py-20 lg:py-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto text-center"
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-mono mb-8"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
            npm install @hwsigner/core
          </motion.div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
            <span className="text-foreground">Unified Solana</span>
            <br />
            <span className="text-gradient-solana">Hardware Wallet SDK</span>
          </h1>

          <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto mb-4 leading-relaxed">
            One adapter-based API to connect, derive accounts, and sign transactions across every major hardware wallet.
          </p>

          <p className="text-muted-foreground/60 text-sm font-mono mb-10">
            Ledger / Trezor / Keystone / more planned
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
            <a
              href="#playground"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:brightness-110 transition-all glow-primary"
            >
              Open Playground
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#architecture"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg border border-border bg-surface-1 text-foreground font-medium text-sm hover:bg-surface-2 transition-colors"
            >
              View Architecture
            </a>
          </div>

          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mb-16">
            <a href="#developer" className="hover:text-foreground transition-colors underline underline-offset-4 decoration-border">View API</a>
            <span className="text-border">/</span>
            <a href="#wallets" className="hover:text-foreground transition-colors underline underline-offset-4 decoration-border">Explore Wallets</a>
            <span className="text-border">/</span>
            <a href="#capabilities" className="hover:text-foreground transition-colors underline underline-offset-4 decoration-border">Capability Matrix</a>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-2"
          >
            {badges.map((badge) => (
              <span
                key={badge.label}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-surface-1 text-xs text-muted-foreground"
              >
                <badge.icon className="h-3 w-3" />
                {badge.label}
              </span>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
