import { motion } from 'framer-motion';
import { wallets } from '@/data/wallets';
import { Check, X, Minus } from 'lucide-react';

const capLabels = [
  ['connect', 'Connect'],
  ['usb', 'USB'],
  ['ble', 'BLE'],
  ['nfc', 'NFC'],
  ['qr', 'QR'],
  ['getAccounts', 'Get Accounts'],
  ['signTransaction', 'Sign Tx'],
  ['signVersionedTransaction', 'Sign V. Tx'],
  ['signMessage', 'Sign Message'],
  ['emulatorMode', 'Emulator'],
  ['react', 'React'],
  ['reactNative', 'React Native'],
] as const;

export default function CapabilityMatrix() {
  return (
    <section className="relative py-24 lg:py-32" id="capabilities">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} className="text-center mb-12">
          <p className="text-primary text-xs font-mono uppercase tracking-widest mb-3">Capability Matrix</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Feature coverage per wallet</h2>
          <p className="text-muted-foreground max-w-lg mx-auto text-sm">
            A transparent view of what each adapter supports today.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-6xl mx-auto overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-1">
                <th className="text-left px-4 py-3 font-mono text-muted-foreground font-medium sticky left-0 bg-surface-1 z-10">Wallet</th>
                {capLabels.map(([, label]) => (
                  <th key={label} className="px-3 py-3 text-center font-mono text-muted-foreground font-medium whitespace-nowrap">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {wallets.map((w, i) => (
                <tr key={w.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? 'bg-card' : 'bg-surface-1/50'}`}>
                  <td className="px-4 py-2.5 font-medium sticky left-0 z-10" style={{ backgroundColor: i % 2 === 0 ? 'hsl(var(--card))' : 'hsl(var(--surface-1) / 0.5)' }}>
                    <span style={{ color: w.color }}>{w.name}</span>
                  </td>
                  {capLabels.map(([key]) => {
                    const val = w.capabilities[key];
                    const isPlanned = w.status === 'planned';
                    return (
                      <td key={key} className="px-3 py-2.5 text-center">
                        {isPlanned ? (
                          <Minus className="h-3.5 w-3.5 mx-auto text-muted-foreground/30" />
                        ) : val ? (
                          <Check className="h-3.5 w-3.5 mx-auto text-success" />
                        ) : (
                          <X className="h-3.5 w-3.5 mx-auto text-muted-foreground/30" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        <p className="max-w-6xl mx-auto mt-3 text-[11px] text-muted-foreground">
          The matrix reflects what the current HWSigner adapter actually implements in this demo runtime, not every transport a vendor may support on paper.
        </p>
      </div>
    </section>
  );
}
