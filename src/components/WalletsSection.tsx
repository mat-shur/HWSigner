import { motion } from 'framer-motion';
import { wallets, statusLabels, statusColors } from '@/data/wallets';
import { Shield, Lock, QrCode, Wallet, Key, Cpu, CreditCard, Smartphone, Layers, Fingerprint } from 'lucide-react';

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

const iconMap: Record<string, IconComponent> = {
  Shield, Lock, QrCode, Wallet, Key, Cpu, CreditCard, Smartphone, Layers, Fingerprint,
};

export default function WalletsSection() {
  return (
    <section className="relative py-24 lg:py-32" id="wallets">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} className="text-center mb-16">
          <p className="text-primary text-xs font-mono uppercase tracking-widest mb-3">Wallet Adapters</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Supported hardware wallets</h2>
          <p className="text-muted-foreground max-w-lg mx-auto text-sm">
            Ledger is live today. The remaining wallets stay visible as upcoming adapters.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {wallets.map((w, i) => {
            const Icon = iconMap[w.icon] || Shield;
            return (
              <motion.div key={w.id} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.03 }}
                className="group relative p-4 rounded-xl border border-border bg-card hover:border-primary/20 transition-all duration-300">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-2"
                    style={{ borderColor: `${w.color}22` }}>
                    <Icon className="h-5 w-5" style={{ color: w.color }} />
                  </div>
                  <span className={`inline-flex text-[10px] font-mono px-2 py-0.5 rounded-full border ${statusColors[w.status]}`}>
                    {statusLabels[w.status]}
                  </span>
                </div>
                <h3 className="text-sm font-semibold mb-1">{w.name}</h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">{w.description}</p>
                <div className="flex flex-wrap gap-1">
                  {w.transports.map(t => (
                    <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border bg-surface-2 text-muted-foreground">
                      {t}
                    </span>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
