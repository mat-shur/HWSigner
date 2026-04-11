import { Terminal, Layers, Puzzle, Play, Code2, Plug } from 'lucide-react';

const links = [
  { label: 'Playground', href: '#playground', icon: Play },
  { label: 'API', href: '#developer', icon: Code2 },
  { label: 'Architecture', href: '#architecture', icon: Layers },
  { label: 'Adapters', href: '#adapter-guide', icon: Plug },
  { label: 'Wallets', href: '#wallets', icon: Puzzle },
];

export default function Footer() {
  return (
    <footer className="border-t border-border bg-surface-1/50 py-12">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 border border-primary/20">
                <Terminal className="h-3 w-3 text-primary" />
              </div>
              <span className="font-semibold text-sm">HWSigner</span>
            </div>
            <p className="text-xs text-muted-foreground max-w-sm">
              Unified Solana hardware wallet SDK. One adapter-based API for every device.
            </p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <link.icon className="h-3.5 w-3.5" />
                {link.label}
              </a>
            ))}
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-[11px] text-muted-foreground/50 font-mono">
            hwsigner / open source / MIT license
          </p>
        </div>
      </div>
    </footer>
  );
}
