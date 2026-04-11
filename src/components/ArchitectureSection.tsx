import { motion } from 'framer-motion';

const layers = [
  { label: 'Your App', desc: 'Consumer application', color: 'hsl(var(--foreground))' },
  { label: 'HWSigner Core', desc: 'Unified API / capability awareness / event system', color: 'hsl(var(--primary))', highlight: true },
  { label: 'Wallet Adapters', desc: 'Ledger / Trezor / QR signers / WalletConnect-backed wallets / vendor SDK adapters', color: 'hsl(var(--info))' },
  { label: 'Transport Runtimes', desc: 'WebHID / WebUSB / Web BLE / WalletConnect / injected providers / emulators / native NFC', color: 'hsl(var(--warning))' },
  { label: 'Hardware Devices', desc: 'Physical wallets / emulators / air-gapped signers', color: 'hsl(var(--muted-foreground))' },
];

export default function ArchitectureSection() {
  return (
    <section className="relative py-24 lg:py-32" id="architecture">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-primary text-xs font-mono uppercase tracking-widest mb-3">Package Architecture</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">How it&apos;s structured</h2>
          <p className="text-muted-foreground max-w-lg mx-auto text-sm">
            A layered adapter architecture that cleanly separates wallet logic from transport runtimes.
          </p>
        </motion.div>

        <div className="max-w-2xl mx-auto space-y-3">
          {layers.map((layer, index) => (
            <motion.div
              key={layer.label}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`relative p-5 rounded-xl border transition-all ${
                layer.highlight ? 'border-primary/30 bg-primary/5 glow-primary-sm' : 'border-border bg-card'
              }`}
            >
              {index > 0 && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-px h-3 bg-border" />
              )}
              <div className="flex items-center gap-3">
                <div className="w-1 h-8 rounded-full" style={{ backgroundColor: layer.color }} />
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: layer.highlight ? layer.color : undefined }}>
                    {layer.label}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">{layer.desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
