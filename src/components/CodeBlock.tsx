type CodeBlockProps = {
  code: string;
  filename: string;
  language?: string;
  maxHeightClassName?: string;
};

type HighlightSegment = {
  text: string;
  className: string;
};

const codeKeywords = new Set([
  'await',
  'async',
  'class',
  'const',
  'export',
  'false',
  'from',
  'function',
  'if',
  'import',
  'new',
  'null',
  'return',
  'throw',
  'true',
  'type',
]);

const codeIdentifiers = new Set([
  'Connection',
  'ExistingRuntimes',
  'HWSignerEventListener',
  'HWSignerRuntime',
  'MyWalletAdapter',
  'MyWalletClient',
  'PublicKey',
  'ReactNativeSolanaWalletClient',
  'RNTangemSdk',
  'SystemProgram',
  'Transaction',
  'TransactionMessage',
  'UnsupportedOperationError',
  'VersionedTransaction',
  'WalletAdapter',
  'createHWSigner',
  'createMyWalletAdapter',
  'createReactNativeHWSigner',
  'getAccounts',
  'getLatestBlockhash',
  'signTransaction',
  'signVersionedTransaction',
]);

export default function CodeBlock({
  code,
  filename,
  language = 'ts',
  maxHeightClassName = 'max-h-[440px]',
}: CodeBlockProps) {
  const lines = highlightCode(code);

  return (
    <div className="rounded-xl border border-border bg-[#0b1120] overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#0f172a] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-destructive/50" />
            <div className="h-2.5 w-2.5 rounded-full bg-warning/50" />
            <div className="h-2.5 w-2.5 rounded-full bg-success/50" />
          </div>
          <span className="ml-2 truncate text-[10px] font-mono text-slate-400">{filename}</span>
        </div>
        <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-mono text-slate-400">
          {language}
        </span>
      </div>
      <div className={`${maxHeightClassName} overflow-auto p-4`}>
        <code className="block font-mono text-[12px] leading-6">
          {lines.map((line, index) => (
            <div key={`${filename}-${index + 1}`} className="whitespace-pre-wrap break-words">
              {line.length === 0 ? <span>&nbsp;</span> : line.map((segment, segmentIndex) => (
                <span key={`${filename}-${index + 1}-${segmentIndex}`} className={segment.className}>
                  {segment.text}
                </span>
              ))}
            </div>
          ))}
        </code>
      </div>
    </div>
  );
}

function highlightCode(code: string): HighlightSegment[][] {
  return code.split('\n').map((line) => tokenizeCodeLine(line));
}

function tokenizeCodeLine(line: string): HighlightSegment[] {
  const tokens: HighlightSegment[] = [];
  const pattern = /(\/\/.*$|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|`(?:\\.|[^`])*`|\b\d+(?:_\d+)*(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b|[{}()[\].,:;?])/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null = pattern.exec(line);

  while (match) {
    if (match.index > lastIndex) {
      tokens.push({
        text: line.slice(lastIndex, match.index),
        className: 'text-slate-100',
      });
    }

    const value = match[0];
    tokens.push({
      text: value,
      className: getCodeTokenClassName(value),
    });

    lastIndex = pattern.lastIndex;
    match = pattern.exec(line);
  }

  if (lastIndex < line.length) {
    tokens.push({
      text: line.slice(lastIndex),
      className: 'text-slate-100',
    });
  }

  return tokens;
}

function getCodeTokenClassName(token: string): string {
  if (token.startsWith('//')) {
    return 'text-slate-500';
  }

  if (token.startsWith("'") || token.startsWith('"') || token.startsWith('`')) {
    return 'text-emerald-300';
  }

  if (/^\d/.test(token)) {
    return 'text-amber-300';
  }

  if (codeKeywords.has(token)) {
    return 'text-sky-300';
  }

  if (codeIdentifiers.has(token)) {
    return 'text-cyan-300';
  }

  if (/^[{}()[\].,:;?]$/.test(token)) {
    return 'text-slate-500';
  }

  return 'text-slate-100';
}
