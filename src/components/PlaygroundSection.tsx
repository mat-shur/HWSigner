import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { wallets, type Wallet, type WalletRuntime, statusLabels, statusColors } from '@/data/wallets';
import { buildWalletCodeExamples } from '@/data/code-examples';
import { createEvent, playgroundDefaults, type EventLogEntry } from '@/data/mock';
import { speculosGuideLinks, speculosGuideNotes, speculosGuideSteps } from '@/data/speculos-guide';
import { createHWSigner } from '@/lib/hwsigner/create-signer';
import { getErrorMessage } from '@/lib/hwsigner/errors';
import { createReactNativeHWSigner } from '@/lib/react-native/create-signer';
import type {
  HWSignerAccount,
  HWSignerCapabilities,
  HWSignerConnection,
  HWSignerRuntime,
  SignedMessageResult,
  SignedTransactionResult,
  TransactionSigningPayloadMode,
  WalletAdapter,
} from '@/lib/hwsigner/types';
import {
  createPlaygroundTransaction,
  createPlaygroundVersionedTransaction,
  summarizeTransaction,
} from '@/lib/hwsigner/transactions';
import { DEFAULT_SPECULOS_API_BASE_URL } from '@/lib/ledger/env';
import {
  Shield, Lock, QrCode, Wallet as WalletIcon, Key, Cpu, CreditCard, Smartphone, Layers, Fingerprint,
  Play, Unplug, Search, GitFork, PenTool, FileText, Copy, Check, Loader2, AlertTriangle, ChevronRight, X,
  ExternalLink, Monitor, TerminalSquare, Code2, Usb,
} from 'lucide-react';

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

const iconMap: Record<string, IconComponent> = {
  Shield,
  Lock,
  QrCode,
  Wallet: WalletIcon,
  Key,
  Cpu,
  CreditCard,
  Smartphone,
  Layers,
  Fingerprint,
  Usb,
};

type Tab = 'connect' | 'derive' | 'sign-msg' | 'sign-tx' | 'code';
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
type LoadingAction = 'derive' | 'sign-message' | 'sign-transaction' | null;
type PlaygroundTransactionVersion = 'legacy' | 'v0';

const txVersions: Array<{
  value: PlaygroundTransactionVersion;
  label: string;
}> = [
  { value: 'legacy', label: 'Legacy' },
  { value: 'v0', label: 'Versioned' },
];

const txSigningModes: Array<{
  value: TransactionSigningPayloadMode;
  label: string;
  description: string;
  versions: PlaygroundTransactionVersion[];
}> = [
  {
    value: 'serialized-transaction',
    label: 'serialized-transaction',
    description: 'Full serialized transaction bytes.',
    versions: ['legacy', 'v0'],
  },
  {
    value: 'legacy-message-bytes',
    label: 'legacy-message-bytes',
    description: 'Legacy transaction message bytes.',
    versions: ['legacy'],
  },
  {
    value: 'versioned-message-bytes',
    label: 'versioned-message-bytes',
    description: 'Versioned transaction message bytes.',
    versions: ['v0'],
  },
];

export default function PlaygroundSection() {
  const [selectedWallet, setSelectedWallet] = useState<Wallet>(wallets[0]);
  const [selectedRuntime, setSelectedRuntime] = useState(getDefaultRuntimeId(wallets[0]));
  const [activeTab, setActiveTab] = useState<Tab>('connect');
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [derivedAccounts, setDerivedAccounts] = useState<HWSignerAccount[]>([]);
  const [selectedAccountIdx, setSelectedAccountIdx] = useState(0);
  const [signResult, setSignResult] = useState<SignedMessageResult | null>(null);
  const [txResult, setTxResult] = useState<SignedTransactionResult | null>(null);
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedCodeExampleId, setSelectedCodeExampleId] = useState('setup');
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showSpeculosGuide, setShowSpeculosGuide] = useState(false);
  const [derivationIndex, setDerivationIndex] = useState(0);
  const [deriveCount, setDeriveCount] = useState(playgroundDefaults.deriveCount);
  const [message, setMessage] = useState(playgroundDefaults.message);
  const [connectionInfo, setConnectionInfo] = useState<HWSignerConnection | null>(null);
  const [txVersion, setTxVersion] = useState<PlaygroundTransactionVersion>('legacy');
  const [txSigningPayloadMode, setTxSigningPayloadMode] = useState<TransactionSigningPayloadMode>('serialized-transaction');
  const signerRef = useRef<WalletAdapter | null>(null);

  const addEvent = useCallback((type: EventLogEntry['type'], messageText: string) => {
    setEvents((prev) => [createEvent(type, messageText), ...prev].slice(0, 50));
  }, []);

  const selectedRuntimeMeta = useMemo(
    () => selectedWallet.runtimes.find((runtime) => runtime.id === selectedRuntime) ?? selectedWallet.runtimes[0],
    [selectedRuntime, selectedWallet],
  );
  const runtimeConfig = useMemo(() => getRuntimeConfig(selectedWallet, selectedRuntime), [selectedRuntime, selectedWallet]);
  const isImplementedWallet = selectedWallet.interactive;
  const isRuntimeEnabled = selectedRuntimeMeta?.enabled ?? false;
  const isBusy = loadingAction !== null;
  const runtimeCapabilities = useMemo<HWSignerCapabilities>(
    () => {
      if (!isImplementedWallet || !runtimeConfig) {
        return toSdkCapabilities(selectedWallet);
      }

      try {
        return createSignerForRuntime({
          walletId: selectedWallet.id,
          runtime: runtimeConfig,
        }).getCapabilities();
      } catch {
        return toSdkCapabilities(selectedWallet);
      }
    },
    [isImplementedWallet, runtimeConfig, selectedWallet],
  );
  const activeCapabilities = connectionInfo?.capabilities ?? runtimeCapabilities;
  const activeAccount = derivedAccounts[selectedAccountIdx] ?? null;
  const availableTxVersions = useMemo(
    () => txVersions.filter((version) =>
      version.value === 'v0' ? activeCapabilities.signVersionedTransaction : activeCapabilities.signTransaction),
    [activeCapabilities.signTransaction, activeCapabilities.signVersionedTransaction],
  );
  const availableTxSigningModes = useMemo(
    () => txSigningModes.filter((mode) =>
      mode.versions.includes(txVersion) && isSigningPayloadModeSupported(selectedWallet.id, mode.value, runtimeConfig),
    ),
    [runtimeConfig, selectedWallet.id, txVersion],
  );
  const previewTransaction = useMemo(() => {
    if (!activeAccount?.address) {
      return null;
    }

    const params = {
      fromAddress: activeAccount.address,
      toAddress: playgroundDefaults.transactionRecipient,
      lamports: playgroundDefaults.transactionLamports,
    };

    return txVersion === 'v0'
      ? createPlaygroundVersionedTransaction(params)
      : createPlaygroundTransaction(params);
  }, [activeAccount, txVersion]);
  const previewSummary = useMemo(
    () => (previewTransaction ? summarizeTransaction(previewTransaction) : null),
    [previewTransaction],
  );
  const selectedDerivationPath = activeAccount?.path ?? `m/44'/501'/${derivationIndex}'/0'`;
  const codeExamples = useMemo(
    () => buildWalletCodeExamples({
      walletId: selectedWallet.id,
      walletName: selectedWallet.name,
      supportsSignMessage: activeCapabilities.signMessage,
      runtime: runtimeConfig,
      derivationPath: selectedDerivationPath,
      deriveCount,
      message,
      txVersion,
      txSigningPayloadMode,
      transactionRecipient: playgroundDefaults.transactionRecipient,
      transactionLamports: playgroundDefaults.transactionLamports,
    }),
    [
      activeCapabilities.signMessage,
      deriveCount,
      message,
      runtimeConfig,
      selectedWallet.id,
      selectedWallet.name,
      selectedDerivationPath,
      txSigningPayloadMode,
      txVersion,
    ],
  );
  const selectedCodeExample = useMemo(
    () => codeExamples.find((example) => example.id === selectedCodeExampleId) ?? codeExamples[0] ?? null,
    [codeExamples, selectedCodeExampleId],
  );
  const highlightedCodeLines = useMemo(
    () => (selectedCodeExample ? highlightCode(selectedCodeExample.code) : []),
    [selectedCodeExample],
  );

  useEffect(() => {
    if (!availableTxVersions.some((version) => version.value === txVersion)) {
      setTxVersion(availableTxVersions[0]?.value ?? 'legacy');
    }
  }, [availableTxVersions, txVersion]);

  useEffect(() => {
    if (!availableTxSigningModes.some((mode) => mode.value === txSigningPayloadMode)) {
      setTxSigningPayloadMode(availableTxSigningModes[0]?.value ?? 'serialized-transaction');
    }
  }, [availableTxSigningModes, txSigningPayloadMode]);

  useEffect(() => {
    if (!codeExamples.some((example) => example.id === selectedCodeExampleId)) {
      setSelectedCodeExampleId(codeExamples[0]?.id ?? 'setup');
    }
  }, [codeExamples, selectedCodeExampleId]);

  const handleConnect = useCallback(async () => {
    if (!isImplementedWallet) {
      addEvent('warning', `${selectedWallet.name} remains visible in the catalog, but its adapter is not implemented yet.`);
      return;
    }

    if (!runtimeConfig || !isRuntimeEnabled) {
      addEvent('warning', getUnavailableRuntimeMessage(selectedRuntimeMeta));
      return;
    }

    setShowConnectModal(true);
    setConnectionState('connecting');
    setSignResult(null);
    setTxResult(null);

    const signer = createSignerForRuntime({
      walletId: selectedWallet.id,
      runtime: runtimeConfig,
      onEvent: (event) => addEvent(event.type, event.message),
    });

    try {
      const connection = await signer.connect();
      signerRef.current = signer;
      setConnectionInfo(connection);
      setConnectionState('connected');
      addEvent('success', `Connected to ${selectedWallet.name} via ${selectedRuntimeMeta.label}.`);

      if (connection.appConfiguration) {
        addEvent(
          'info',
          `Solana app ${connection.appConfiguration.version} detected${connection.appConfiguration.blindSigningEnabled ? ' with blind signing enabled' : ''}.`,
        );
      }
    } catch (error) {
      signerRef.current = null;
      setConnectionInfo(null);
      setConnectionState('error');
      addEvent('error', getErrorMessage(error));
    } finally {
      setShowConnectModal(false);
    }
  }, [addEvent, isImplementedWallet, isRuntimeEnabled, runtimeConfig, selectedRuntimeMeta, selectedWallet]);

  const handleDisconnect = useCallback(async (walletName?: string) => {
    try {
      await signerRef.current?.disconnect();
    } catch (error) {
      addEvent('error', getErrorMessage(error));
    } finally {
      signerRef.current = null;
      setConnectionInfo(null);
      setConnectionState('disconnected');
      setDerivedAccounts([]);
      setSelectedAccountIdx(0);
      setSignResult(null);
      setTxResult(null);
      setLoadingAction(null);
      addEvent('info', `Disconnected from ${walletName ?? selectedWallet.name}.`);
    }
  }, [addEvent, selectedWallet.name]);

  const handleWalletSelect = useCallback(async (wallet: Wallet) => {
    if (connectionState === 'connected' || connectionState === 'error') {
      await handleDisconnect(selectedWallet.name);
    }
    setSelectedWallet(wallet);
    setSelectedRuntime(getDefaultRuntimeId(wallet));
    setActiveTab('connect');
  }, [connectionState, handleDisconnect, selectedWallet.name]);

  const handleRuntimeSelect = useCallback(async (runtime: WalletRuntime) => {
    if (connectionState === 'connected' || connectionState === 'error') {
      await handleDisconnect(selectedWallet.name);
    }
    setSelectedRuntime(runtime.id);
  }, [connectionState, handleDisconnect, selectedWallet.name]);

  const handleGetCapabilities = useCallback(() => {
    if (!isImplementedWallet || !runtimeConfig) {
      addEvent('info', `${selectedWallet.name} capabilities: pending implementation.`);
      return;
    }

    const capabilities = createSignerForRuntime({
      walletId: selectedWallet.id,
      runtime: runtimeConfig,
    }).getCapabilities();

    addEvent(
      'info',
      `Capabilities for ${selectedRuntimeMeta.label}: ${Object.entries(capabilities).filter(([, value]) => value).map(([key]) => key).join(', ')}`,
    );
  }, [addEvent, isImplementedWallet, runtimeConfig, selectedRuntimeMeta.label, selectedWallet]);

  const resolveSigningAccount = useCallback(async (): Promise<HWSignerAccount> => {
    if (!signerRef.current) {
      throw new Error('The selected hardware wallet is not connected.');
    }
    if (activeAccount) {
      return activeAccount;
    }

    const [account] = await signerRef.current.getAccounts({
      startIndex: derivationIndex,
      count: 1,
    });

    setDerivedAccounts([account]);
    setSelectedAccountIdx(0);
    return account;
  }, [activeAccount, derivationIndex]);

  const handleDerive = useCallback(async () => {
    if (!signerRef.current || connectionState !== 'connected') {
      return;
    }

    if (!activeCapabilities.getAccounts) {
      addEvent('warning', `${selectedWallet.name} does not support account derivation in the selected runtime.`);
      return;
    }

    setLoadingAction('derive');
    setSignResult(null);
    setTxResult(null);

    try {
      const accounts = await signerRef.current.getAccounts({
        startIndex: derivationIndex,
        count: deriveCount,
      });
      setDerivedAccounts(accounts);
      setSelectedAccountIdx(0);
      addEvent('success', `Derived ${accounts.length} ${selectedWallet.name} account${accounts.length > 1 ? 's' : ''}.`);
    } catch (error) {
      addEvent('error', getErrorMessage(error));
    } finally {
      setLoadingAction(null);
    }
  }, [activeCapabilities.getAccounts, addEvent, connectionState, derivationIndex, deriveCount, selectedWallet.name]);

  const handleSignMessage = useCallback(async () => {
    if (!signerRef.current || connectionState !== 'connected') {
      return;
    }

    if (!activeCapabilities.signMessage) {
      addEvent('warning', `${selectedWallet.name} does not support Solana message signing in the selected runtime.`);
      return;
    }

    setLoadingAction('sign-message');
    setTxResult(null);

    try {
      const result = await signerRef.current.signMessage({
        derivationPath: activeAccount?.path,
        accountIndex: activeAccount ? undefined : derivationIndex,
        message,
      });
      setSignResult(result);
      addEvent('success', 'Message signed successfully.');
    } catch (error) {
      addEvent('error', getErrorMessage(error));
    } finally {
      setLoadingAction(null);
    }
  }, [activeAccount, activeCapabilities.signMessage, addEvent, connectionState, derivationIndex, message, selectedWallet.name]);

  const handleSignTx = useCallback(async () => {
    if (!signerRef.current || connectionState !== 'connected') {
      return;
    }

    const canSign = txVersion === 'v0'
      ? activeCapabilities.signVersionedTransaction
      : activeCapabilities.signTransaction;

    if (!canSign) {
      addEvent('warning', `${selectedWallet.name} does not support ${txVersion === 'v0' ? 'versioned' : 'legacy'} transaction signing in the selected runtime.`);
      return;
    }

    setLoadingAction('sign-transaction');
    setSignResult(null);
    setTxResult(null);

    try {
      const account = await resolveSigningAccount();
      const params = {
        fromAddress: account.address,
        toAddress: playgroundDefaults.transactionRecipient,
        lamports: playgroundDefaults.transactionLamports,
      };
      const result = txVersion === 'v0'
        ? await signerRef.current.signVersionedTransaction({
            derivationPath: account.path,
            transaction: createPlaygroundVersionedTransaction(params),
            signingPayloadMode: txSigningPayloadMode,
          })
        : await signerRef.current.signTransaction({
            derivationPath: account.path,
            transaction: createPlaygroundTransaction(params),
            signingPayloadMode: txSigningPayloadMode,
          });
      setTxResult(result);
      addEvent('success', 'Transaction signed successfully.');
    } catch (error) {
      addEvent('error', getErrorMessage(error));
    } finally {
      setLoadingAction(null);
    }
  }, [
    activeCapabilities.signTransaction,
    activeCapabilities.signVersionedTransaction,
    addEvent,
    connectionState,
    resolveSigningAccount,
    runtimeConfig?.kind,
    selectedWallet.name,
    txSigningPayloadMode,
    txVersion,
  ]);

  const copyToClipboard = useCallback((text: string, field: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedField(field);
    window.setTimeout(() => setCopiedField(null), 2000);
  }, []);

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'connect', label: 'Connect', icon: Play },
    { id: 'derive', label: 'Derive', icon: GitFork },
    { id: 'sign-msg', label: 'Sign Message', icon: PenTool },
    { id: 'sign-tx', label: 'Sign Transaction', icon: FileText },
    { id: 'code', label: 'Code', icon: Code2 },
  ];
  const tabAvailability: Record<Tab, boolean> = {
    connect: true,
    derive: activeCapabilities.getAccounts,
    'sign-msg': activeCapabilities.signMessage,
    'sign-tx': activeCapabilities.signTransaction || activeCapabilities.signVersionedTransaction,
    code: isImplementedWallet,
  };

  const WIcon = iconMap[selectedWallet.icon] || Shield;

  return (
    <section className="relative py-24 lg:py-32" id="playground">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
          <p className="text-primary text-xs font-mono uppercase tracking-widest mb-3">Interactive Playground</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Package Playground</h2>
          <p className="text-muted-foreground max-w-lg mx-auto text-sm">
            Explore how HWSigner connects, derives, and signs across different wallets and runtimes.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-6xl mx-auto rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface-1">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-warning/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-success/60" />
              </div>
              <span className="text-[11px] font-mono text-muted-foreground ml-2">hwsigner-playground</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${connectionState === 'connected' ? 'bg-success' : connectionState === 'connecting' ? 'bg-warning animate-pulse' : connectionState === 'error' ? 'bg-destructive' : 'bg-muted-foreground/40'}`} />
              <span className="text-[10px] font-mono text-muted-foreground capitalize">{connectionState}</span>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row">
            <div className="w-full lg:w-60 border-b lg:border-b-0 lg:border-r border-border bg-surface-1/50 p-3">
              <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest mb-2 px-1">Wallet</p>
              <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto lg:max-h-[430px] pb-2 lg:pb-0 lg:pr-1">
                {wallets.map((wallet) => {
                  const WalletGlyph = iconMap[wallet.icon] || Shield;
                  const isSelected = wallet.id === selectedWallet.id;
                  return (
                    <button
                      key={wallet.id}
                      onClick={() => { void handleWalletSelect(wallet); }}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-left min-w-[140px] lg:min-w-0 transition-all text-xs ${isSelected ? 'bg-surface-3 border border-primary/20' : 'border border-transparent hover:bg-surface-2'}`}
                    >
                      <WalletGlyph className="h-3.5 w-3.5 flex-shrink-0" style={{ color: wallet.color }} />
                      <span className={`min-w-0 flex-1 truncate ${isSelected ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{wallet.name}</span>
                      {wallet.status !== 'live' && (
                        <span className={`ml-auto shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded border ${statusColors[wallet.status]} hidden lg:inline-flex`}>
                          {statusLabels[wallet.status]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4">
                <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest mb-2 px-1">Runtime</p>
                {selectedWallet.runtimes.map((runtime) => {
                  const isSelected = runtime.id === selectedRuntime;
                  return (
                    <button
                      key={runtime.id}
                      onClick={() => {
                        if (!runtime.enabled && runtime.localOnly) {
                          addEvent('warning', 'Speculos is local-only. Enable NEXT_PUBLIC_ENABLE_SPECULOS=true in development.');
                          return;
                        }
                        if (!runtime.enabled && runtime.nativeOnly) {
                          addEvent('warning', `${selectedWallet.name} uses a native React Native runtime. Opening the Code tab instead of running it in the browser.`);
                          setActiveTab('code');
                          void handleRuntimeSelect(runtime);
                          return;
                        }
                        void handleRuntimeSelect(runtime);
                      }}
                      disabled={!runtime.enabled && !runtime.localOnly && !runtime.nativeOnly}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all text-xs mb-1 ${isSelected ? 'bg-surface-3 border border-primary/20' : 'border border-transparent hover:bg-surface-2'} ${!runtime.enabled ? 'opacity-60' : ''}`}
                    >
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      <div className="min-w-0">
                        <span className={isSelected ? 'text-foreground font-medium' : 'text-muted-foreground'}>{runtime.label}</span>
                        <p className="text-[10px] text-muted-foreground/60 hidden lg:block [overflow-wrap:anywhere]">{runtime.description}</p>
                        {runtime.localOnly && <p className="text-[10px] font-mono text-warning/80 mt-0.5 hidden lg:block">local-only</p>}
                        {runtime.nativeOnly && <p className="text-[10px] font-mono text-warning/80 mt-0.5 hidden lg:block">native-only</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex h-[41px] border-b border-border bg-surface-1/30 overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (!tabAvailability[tab.id]) {
                        addEvent('warning', `${selectedWallet.name} does not support ${tab.label.toLowerCase()} in the selected runtime.`);
                        return;
                      }

                      setActiveTab(tab.id);
                    }}
                    className={`flex h-full items-center gap-1.5 px-4 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-primary text-foreground'
                        : tabAvailability[tab.id]
                          ? 'border-transparent text-muted-foreground hover:text-foreground'
                          : 'border-transparent text-muted-foreground/40'
                    }`}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-5 flex-1">
                <AnimatePresence mode="wait">
                  <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                    {activeTab === 'connect' && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-surface-1">
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-surface-2" style={{ borderColor: `${selectedWallet.color}22` }}>
                            <WIcon className="h-6 w-6" style={{ color: selectedWallet.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold">{selectedWallet.name}</h3>
                              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${statusColors[selectedWallet.status]}`}>
                                {statusLabels[selectedWallet.status]}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{selectedWallet.description}</p>
                          </div>
                        </div>

                        {!isImplementedWallet && (
                          <div className="flex items-center gap-2 p-3 rounded-lg border border-warning/20 bg-warning/5 text-warning text-xs">
                            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                            Only the wallets marked interactive are implemented right now. The rest stay visible as pending adapters.
                          </div>
                        )}

                        {isImplementedWallet && !isRuntimeEnabled && selectedRuntimeMeta?.localOnly && (
                          <div className="flex items-center gap-2 p-3 rounded-lg border border-warning/20 bg-warning/5 text-warning text-xs">
                            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                            Speculos is disabled in this environment. Set <span className="font-mono">NEXT_PUBLIC_ENABLE_SPECULOS=true</span> for local development.
                          </div>
                        )}

                        {isImplementedWallet && !isRuntimeEnabled && selectedRuntimeMeta?.nativeOnly && (
                          <div className="flex items-center gap-2 p-3 rounded-lg border border-warning/20 bg-warning/5 text-warning text-xs">
                            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                            This runtime is for a React Native iOS/Android app and cannot run inside the Next.js browser playground. Use the code tab and inject the native wallet client or SDK there.
                          </div>
                        )}

                        {connectionInfo?.appConfiguration && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-lg border border-border bg-surface-1 px-3 py-2">
                            <span className="font-mono">Solana App:</span>
                            <span className="font-mono text-foreground">{connectionInfo.appConfiguration.version}</span>
                            <span className={connectionInfo.appConfiguration.blindSigningEnabled ? 'text-success' : 'text-warning'}>
                              {connectionInfo.appConfiguration.blindSigningEnabled ? 'blind signing enabled' : 'blind signing disabled'}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">Transport:</span>
                          {selectedWallet.transports.map((transport) => (
                            <span key={transport} className="px-2 py-0.5 rounded border border-border bg-surface-2 font-mono">
                              {transport}
                            </span>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          {connectionState === 'connected' ? (
                            <button onClick={() => { void handleDisconnect(); }} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors">
                              <Unplug className="h-3.5 w-3.5" /> Disconnect
                            </button>
                          ) : (
                            <button onClick={() => { void handleConnect(); }} disabled={!isImplementedWallet || !isRuntimeEnabled || connectionState === 'connecting'} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed glow-primary-sm">
                              {connectionState === 'connecting' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                              {connectionState === 'connecting' ? 'Connecting...' : 'Connect'}
                            </button>
                          )}
                          <button onClick={handleGetCapabilities} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-surface-1 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors">
                            <Search className="h-3.5 w-3.5" /> Get Capabilities
                          </button>
                          {selectedRuntime === 'ledger-speculos' && (
                            <button onClick={() => setShowSpeculosGuide(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/20 bg-primary/10 text-sm text-primary hover:bg-primary/15 transition-colors">
                              <Monitor className="h-3.5 w-3.5" /> Speculos Guide
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {activeTab === 'derive' && (
                      <div className="space-y-4">
                        {connectionState !== 'connected' ? (
                          <div className="text-center py-12 text-muted-foreground text-sm">
                            <GitFork className="h-8 w-8 mx-auto mb-3 opacity-30" />
                            Connect {selectedWallet.name} first to derive accounts.
                          </div>
                        ) : (
                          <>
                            <div className="flex items-end gap-3 flex-wrap">
                              <div className="flex-1 min-w-[240px]">
                                <label className="text-[11px] font-mono text-muted-foreground mb-1 block">Derivation Path</label>
                                <div className="px-3 py-2 rounded-lg border border-border bg-surface-1 font-mono text-xs text-foreground">
                                  {`m/44'/501'/${derivationIndex}'/0'`}
                                </div>
                              </div>
                              <div className="w-24">
                                <label className="text-[11px] font-mono text-muted-foreground mb-1 block">Index</label>
                                <input
                                  type="number"
                                  min={0}
                                  max={99}
                                  value={derivationIndex}
                                  onChange={(event) => setDerivationIndex(Math.max(0, Number(event.target.value) || 0))}
                                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface-1 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                                />
                              </div>
                              <div className="w-24">
                                <label className="text-[11px] font-mono text-muted-foreground mb-1 block">Count</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={5}
                                  value={deriveCount}
                                  onChange={(event) => setDeriveCount(Math.min(5, Math.max(1, Number(event.target.value) || 1)))}
                                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface-1 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                                />
                              </div>
                              <button onClick={() => { void handleDerive(); }} disabled={isBusy} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 transition-all disabled:opacity-40 glow-primary-sm">
                                {loadingAction === 'derive' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitFork className="h-3.5 w-3.5" />}
                                Derive
                              </button>
                            </div>

                            {derivedAccounts.length > 0 && (
                              <div className="rounded-xl border border-border overflow-hidden">
                                {derivedAccounts.map((account, index) => (
                                  <div key={account.path} onClick={() => setSelectedAccountIdx(index)} className={`flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 cursor-pointer transition-colors text-xs ${index === selectedAccountIdx ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-surface-1'}`}>
                                    <span className="font-mono text-muted-foreground w-8">#{account.index}</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-mono text-foreground truncate">{account.address}</p>
                                      <p className="font-mono text-muted-foreground text-[10px] mt-0.5">{account.path}</p>
                                    </div>
                                    <button onClick={(event) => { event.stopPropagation(); copyToClipboard(account.address, account.address); }} className="p-1 rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors">
                                      {copiedField === account.address ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {activeTab === 'sign-msg' && (
                      <div className="space-y-4">
                        {connectionState !== 'connected' ? (
                          <div className="text-center py-12 text-muted-foreground text-sm">
                            <PenTool className="h-8 w-8 mx-auto mb-3 opacity-30" />
                            Connect {selectedWallet.name} first to sign messages.
                          </div>
                        ) : !activeCapabilities.signMessage ? (
                          <div className="flex items-center gap-2 p-3 rounded-lg border border-warning/20 bg-warning/5 text-warning text-xs">
                            <AlertTriangle className="h-4 w-4" />
                            {selectedWallet.name} does not support Solana message signing in the selected runtime.
                          </div>
                        ) : (
                          <>
                            <div>
                              <label className="text-[11px] font-mono text-muted-foreground mb-1 block">Message</label>
                              <textarea value={message} onChange={(event) => setMessage(event.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-surface-1 text-xs font-mono text-foreground resize-none h-20 focus:outline-none focus:ring-1 focus:ring-primary/50" />
                            </div>
                            <button onClick={() => { void handleSignMessage(); }} disabled={isBusy} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 transition-all disabled:opacity-40 glow-primary-sm">
                              {loadingAction === 'sign-message' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PenTool className="h-3.5 w-3.5" />}
                              {loadingAction === 'sign-message' ? 'Awaiting device...' : 'Sign Message'}
                            </button>
                            {signResult && (
                              <div className="rounded-xl border border-border bg-surface-1 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Signature</span>
                                  <div className="flex items-center gap-1.5">
                                    {signResult.verified === true && <span className="text-[10px] font-mono text-success flex items-center gap-1"><Check className="h-3 w-3" /> Verified</span>}
                                    <button onClick={() => copyToClipboard(signResult.signature, 'sig')} className="p-1 rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground">
                                      {copiedField === 'sig' ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                                    </button>
                                  </div>
                                </div>
                                <p className="font-mono text-[11px] text-foreground break-all">{signResult.signature}</p>
                                <div className="text-[10px] font-mono text-muted-foreground break-all">
                                  {signResult.address} | {signResult.derivationPath}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {activeTab === 'sign-tx' && (
                      <div className="space-y-4">
                        {connectionState !== 'connected' ? (
                          <div className="text-center py-12 text-muted-foreground text-sm">
                            <FileText className="h-8 w-8 mx-auto mb-3 opacity-30" />
                            Connect {selectedWallet.name} first to sign transactions.
                          </div>
                        ) : !(txVersion === 'v0' ? activeCapabilities.signVersionedTransaction : activeCapabilities.signTransaction) ? (
                          <div className="flex items-center gap-2 p-3 rounded-lg border border-warning/20 bg-warning/5 text-warning text-xs">
                            <AlertTriangle className="h-4 w-4" />
                            {selectedWallet.name} does not support {txVersion === 'v0' ? 'versioned transaction' : 'legacy transaction'} signing in the selected runtime.
                          </div>
                        ) : !previewTransaction ? (
                          <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-surface-1 text-muted-foreground text-xs">
                            <AlertTriangle className="h-4 w-4" />
                            Derive or select a {selectedWallet.name} account first. The transaction preview is built from the selected account address.
                          </div>
                        ) : (
                          <>
                            <div className="rounded-xl border border-border bg-surface-1 p-4 space-y-3">
                              <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div>
                                  <p className="text-xs font-semibold">Transaction Format</p>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    Build either a legacy Solana transaction or a versioned v0 transaction.
                                  </p>
                                </div>
                              </div>
                              <div className={`grid gap-2 ${availableTxVersions.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                {availableTxVersions.map((option) => {
                                  const isSelected = txVersion === option.value;
                                  return (
                                    <button
                                      key={option.value}
                                      type="button"
                                      onClick={() => setTxVersion(option.value)}
                                      className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                                        isSelected
                                          ? 'border-primary/40 bg-primary/10 text-foreground'
                                          : 'border-border bg-surface-2 text-muted-foreground hover:bg-surface-3 hover:text-foreground'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-medium">{option.label}</span>
                                        {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="rounded-xl border border-border bg-surface-1 p-4 space-y-3">
                              <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div>
                                  <p className="text-xs font-semibold">Signing Payload</p>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    Choose the exact signing payload mode supported by the selected wallet runtime.
                                  </p>
                                </div>
                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                                  runtimeConfig?.kind === 'speculos'
                                    ? 'border-warning/20 bg-warning/5 text-warning'
                                    : 'border-border bg-surface-2 text-muted-foreground'
                                }`}>
                                  applies to both runtimes
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {availableTxSigningModes.map((mode) => {
                                  const isSelected = txSigningPayloadMode === mode.value;
                                  return (
                                    <button
                                      key={mode.value}
                                      type="button"
                                      onClick={() => setTxSigningPayloadMode(mode.value)}
                                      className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                                        isSelected
                                          ? 'border-primary/40 bg-primary/10 text-foreground'
                                          : 'border-border bg-surface-2 text-muted-foreground hover:bg-surface-3 hover:text-foreground'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-medium break-all">{mode.label}</span>
                                        {isSelected && <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
                                      </div>
                                      <p className="text-[10px] font-mono mt-1 opacity-80">{mode.description}</p>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="rounded-xl border border-border bg-surface-1 p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold">Transaction Summary</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-border bg-surface-2 text-muted-foreground">devnet</span>
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-border bg-surface-2 text-muted-foreground">
                                    {txVersion === 'v0' ? 'v0' : 'legacy'}
                                  </span>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                <div><span className="text-muted-foreground block text-[10px] font-mono mb-0.5">Type</span>{txVersion === 'v0' ? 'Versioned Transfer' : 'Transfer'}</div>
                                <div><span className="text-muted-foreground block text-[10px] font-mono mb-0.5">Amount</span>{(playgroundDefaults.transactionLamports / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 9 })} SOL</div>
                                <div className="col-span-2"><span className="text-muted-foreground block text-[10px] font-mono mb-0.5">From</span><span className="font-mono text-[11px] break-all">{activeAccount?.address}</span></div>
                                <div className="col-span-2"><span className="text-muted-foreground block text-[10px] font-mono mb-0.5">To</span><span className="font-mono text-[11px] break-all">{playgroundDefaults.transactionRecipient}</span></div>
                                <div className="col-span-2"><span className="text-muted-foreground block text-[10px] font-mono mb-0.5">Recent Blockhash</span><span className="font-mono text-[11px] break-all">{previewSummary?.recentBlockhash}</span></div>
                              </div>
                              <div className="border-t border-border pt-3">
                                <span className="text-[10px] font-mono text-muted-foreground uppercase block mb-2">Instructions</span>
                                {previewSummary?.instructions.map((instruction, index) => (
                                  <div key={`${instruction.program}-${instruction.type}-${index}`} className="flex items-center gap-2 text-xs">
                                    <span className="font-mono text-primary">{instruction.program}</span>
                                    <span className="text-muted-foreground">-&gt;</span>
                                    <span className="font-mono text-muted-foreground">{instruction.data}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <button onClick={() => { void handleSignTx(); }} disabled={isBusy} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 transition-all disabled:opacity-40 glow-primary-sm">
                              {loadingAction === 'sign-transaction' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                              {loadingAction === 'sign-transaction' ? 'Awaiting device...' : 'Sign Transaction'}
                            </button>
                            {txResult && (
                              <div className="rounded-xl border border-success/20 bg-success/5 p-4 space-y-2">
                                <div className="flex items-center gap-2 text-success text-xs font-medium">
                                  <Check className="h-4 w-4" /> Transaction Signed
                                </div>
                                <div className="space-y-2 text-xs">
                                  <div>
                                    <span className="text-muted-foreground font-mono text-[10px]">Signature</span>
                                    <p className="font-mono text-[11px] break-all mt-0.5">{txResult.signature}</p>
                                  </div>
                                  <div className="grid grid-cols-1 gap-2">
                                    <div>
                                      <span className="text-muted-foreground font-mono text-[10px]">Derivation Path</span>
                                      <p className="font-mono text-[11px] break-all mt-0.5">{txResult.derivationPath}</p>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground font-mono text-[10px]">Recent Blockhash</span>
                                      <p className="font-mono text-[11px] break-all mt-0.5">{txResult.recentBlockhash}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {activeTab === 'code' && (
                      <div className="space-y-4">
                        {!isImplementedWallet ? (
                          <div className="flex items-center gap-2 p-3 rounded-lg border border-warning/20 bg-warning/5 text-warning text-xs">
                            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                            Code examples are only available for implemented adapters in this step.
                          </div>
                        ) : (
                          <>
                            <div className="rounded-xl border border-border bg-surface-1 p-4">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold">Implemented SDK Examples</p>
                                <p className="text-[11px] text-muted-foreground mt-1">
                                  The code below is generated from the current runtime, transaction format, and signing payload selection. Transaction snippets use native `@solana/web3.js` objects directly.
                                </p>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {codeExamples.map((example) => {
                                  const isSelected = selectedCodeExample?.id === example.id;
                                  return (
                                    <button
                                      key={example.id}
                                      onClick={() => setSelectedCodeExampleId(example.id)}
                                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[11px] transition-colors ${
                                        isSelected
                                          ? 'border-success/50 bg-success/10 text-foreground'
                                          : 'border-border bg-surface-2/60 text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                                      }`}
                                    >
                                      <span className="font-medium">{example.title}</span>
                                    </button>
                                  );
                                })}
                              </div>
                              <p className="mt-3 text-[10px] text-muted-foreground">
                                {selectedCodeExample?.description}
                              </p>
                              <div className="mt-3 grid gap-2 md:grid-cols-3">
                                <div className="rounded-lg border border-border bg-surface-2/70 px-3 py-2">
                                  <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Runtime</p>
                                  <p className="text-xs font-medium mt-1">{selectedRuntimeMeta.label}</p>
                                </div>
                                <div className="rounded-lg border border-border bg-surface-2/70 px-3 py-2">
                                  <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Transaction Format</p>
                                  <p className="text-xs font-medium mt-1">{txVersion === 'v0' ? 'Versioned' : 'Legacy'}</p>
                                </div>
                                <div className="rounded-lg border border-border bg-surface-2/70 px-3 py-2">
                                  <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Signing Payload</p>
                                  <p className="text-xs font-medium mt-1 break-all">{txSigningPayloadMode}</p>
                                </div>
                              </div>
                            </div>

                            <div className="rounded-xl border border-border bg-[#0b1120] overflow-hidden">
                              {selectedCodeExample && (
                                <>
                                  <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#0f172a] px-4 py-3">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <Code2 className="h-4 w-4 flex-shrink-0 text-primary" />
                                      <span className="truncate text-[11px] font-mono text-slate-300">
                                        {selectedCodeExample.id}.ts
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                                      <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5">ts</span>
                                      <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5">{selectedRuntimeMeta.label}</span>
                                    </div>
                                  </div>
                                  <div className="max-h-[440px] overflow-auto p-4">
                                    <code className="block font-mono text-[12px] leading-6">
                                      {highlightedCodeLines.map((line, index) => (
                                        <div key={`${selectedCodeExample.id}-${index + 1}`} className="whitespace-pre-wrap break-words">
                                          {line.length === 0 ? <span>&nbsp;</span> : line.map((segment, segmentIndex) => (
                                            <span key={`${selectedCodeExample.id}-${index + 1}-${segmentIndex}`} className={segment.className}>
                                              {segment.text}
                                            </span>
                                          ))}
                                        </div>
                                      ))}
                                    </code>
                                  </div>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-border bg-surface-1/30 flex flex-col">
              <div className="flex h-[41px] items-center px-4 border-b border-border">
                <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">Event Log</p>
              </div>
              <div className="h-64 lg:h-[500px] overflow-y-auto overflow-x-hidden p-3 pr-2 space-y-1.5">
                {events.length === 0 && <p className="text-[11px] text-muted-foreground/50 text-center pt-8">No events yet. Start by connecting.</p>}
                {events.map((event) => (
                  <div key={event.id} className="flex min-w-0 items-start gap-2 text-[11px] font-mono leading-relaxed">
                    <span className="text-muted-foreground/50 flex-shrink-0">{event.timestamp}</span>
                    <span className={`min-w-0 flex-1 whitespace-pre-wrap break-all ${event.type === 'success' ? 'text-success' : event.type === 'error' ? 'text-destructive' : event.type === 'warning' ? 'text-warning' : event.type === 'action' ? 'text-primary' : 'text-muted-foreground'}`}>
                      {event.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showConnectModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-semibold">Connecting to {selectedWallet.name}</h3>
                <button disabled className="p-1 rounded-lg text-muted-foreground/40 cursor-not-allowed">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-col items-center py-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface-2 mb-4 animate-float" style={{ borderColor: `${selectedWallet.color}33` }}>
                  <WIcon className="h-8 w-8" style={{ color: selectedWallet.color }} />
                </div>
                <Loader2 className="h-5 w-5 animate-spin text-primary mb-3" />
                <p className="text-sm text-muted-foreground">Waiting for device...</p>
                <p className="text-[11px] text-muted-foreground/60 font-mono mt-1">Runtime: {selectedRuntimeMeta?.label}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSpeculosGuide && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.97, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 12 }} className="w-full max-w-5xl max-h-[88vh] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-1">
                <div className="min-w-0">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-primary mb-1">Speculos Guide</p>
                  <h3 className="text-base font-semibold">Run Speculos locally for HWSigner</h3>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Based on your setup notes: Windows host, Docker Desktop, app-solana build output, and the headless workaround.
                  </p>
                </div>
                <button onClick={() => setShowSpeculosGuide(false)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[calc(88vh-81px)] overflow-y-auto p-6 space-y-6">
                <div className="grid gap-4 lg:grid-cols-[1.3fr,0.9fr]">
                  <div className="rounded-2xl border border-border bg-surface-1 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <TerminalSquare className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold">Recommended Flow</p>
                    </div>
                    <div className="space-y-4">
                      {speculosGuideSteps.map((step) => (
                        <div key={step.title} className="rounded-xl border border-border bg-surface-2/70 p-4">
                          <p className="text-sm font-medium">{step.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-1.5">{step.body}</p>
                          {step.command && (
                            <pre className="mt-3 rounded-lg border border-border bg-background/70 p-3 text-[11px] font-mono text-foreground whitespace-pre-wrap break-all overflow-x-auto">
                              <code>{step.command}</code>
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-border bg-surface-1 p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Monitor className="h-4 w-4 text-primary" />
                        <p className="text-sm font-semibold">Why This Exists</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-6">
                        This runtime is for local development when you do not have a physical Ledger on hand. It is good for adapter logic,
                        derivation, signing flows, and bridge behavior. It does not replace real USB or BLE testing.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-border bg-surface-1 p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        <p className="text-sm font-semibold">Notes From Your Setup</p>
                      </div>
                      <div className="space-y-2">
                        {speculosGuideNotes.map((note) => (
                          <div key={note} className="rounded-lg border border-border bg-surface-2/70 px-3 py-2 text-[11px] text-muted-foreground">
                            {note}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-surface-1 p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <ExternalLink className="h-4 w-4 text-primary" />
                        <p className="text-sm font-semibold">Official Links</p>
                      </div>
                      <div className="space-y-2.5">
                        {speculosGuideLinks.map((link) => (
                          <a
                            key={link.href}
                            href={link.href}
                            target="_blank"
                            rel="noreferrer"
                            className="block rounded-xl border border-border bg-surface-2/70 p-3 hover:bg-surface-3 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-foreground">{link.title}</span>
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">{link.description}</p>
                            <p className="text-[10px] font-mono text-primary/80 mt-2 break-all">{link.href}</p>
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function getDefaultRuntimeId(wallet: Wallet): string {
  return wallet.runtimes.find((runtime) => runtime.enabled)?.id ?? wallet.runtimes[0].id;
}

function getRuntimeConfig(wallet: Wallet, runtimeId: string): HWSignerRuntime | null {
  if (wallet.id === 'ledger') {
    if (runtimeId === 'ledger-real') {
      return { kind: 'real-device', transport: 'webhid' };
    }
    if (runtimeId === 'ledger-speculos') {
      return { kind: 'speculos', apiBaseUrl: DEFAULT_SPECULOS_API_BASE_URL };
    }
  }

  if (wallet.id === 'trezor' && runtimeId === 'trezor-connect') {
    return { kind: 'trezor-connect', transport: 'popup-bridge' };
  }

  if (wallet.id === 'keystone' && runtimeId === 'keystone-qr') {
    return { kind: 'keystone-qr', transport: 'qr' };
  }

  if (wallet.id === 'keystone' && runtimeId === 'keystone-react-native-qr') {
    return {
      kind: 'react-native-keystone-qr',
      transport: 'qr',
      wallet: createNativePlaceholderWallet('Keystone'),
      walletName: 'Keystone',
    };
  }

  if (wallet.id === 'dcent' && runtimeId === 'dcent-walletconnect') {
    return { kind: 'dcent-walletconnect', transport: 'qr' };
  }

  if (wallet.id === 'ellipal' && runtimeId === 'ellipal-walletconnect') {
    return { kind: 'ellipal-walletconnect', transport: 'qr' };
  }

  if (wallet.id === 'tangem' && runtimeId === 'tangem-react-native-nfc') {
    return {
      kind: 'tangem-react-native-nfc',
      transport: 'nfc',
      defaultDerivationPath: "m/44'/501'/0'/0'",
    };
  }

  if (wallet.id === 'tangem' && runtimeId === 'tangem-walletconnect') {
    return { kind: 'tangem-walletconnect', transport: 'qr' };
  }

  if (wallet.id === 'solflare-shield' && runtimeId === 'solflare-shield-sdk') {
    return {
      kind: 'solflare-shield-sdk',
      transport: 'nfc',
      network: 'devnet',
    };
  }

  if (wallet.id === 'gridplus-lattice' && runtimeId === 'gridplus-nufi-provider') {
    return { kind: 'gridplus-nufi-provider', transport: 'injected-provider' };
  }

  if (wallet.id === 'arculus' && runtimeId === 'arculus-walletconnect') {
    return { kind: 'arculus-walletconnect', transport: 'qr' };
  }

  if (wallet.id === 'keypal' && runtimeId === 'keypal-tokenpocket-provider') {
    return { kind: 'keypal-tokenpocket-provider', transport: 'injected-provider' };
  }

  if (wallet.id === 'bc-vault' && runtimeId === 'bc-vault-walletconnect') {
    return { kind: 'bc-vault-walletconnect', transport: 'qr' };
  }

  if (wallet.id === 'coolwallet' && runtimeId === 'coolwallet-web-ble') {
    return { kind: 'coolwallet-web-ble', transport: 'web-ble' };
  }

  if (wallet.id === 'cypherock' && runtimeId === 'cypherock-webusb') {
    return { kind: 'cypherock-webusb', transport: 'webusb' };
  }

  if (wallet.id === 'safepal' && runtimeId === 'safepal-provider') {
    return { kind: 'safepal-provider', transport: 'injected-provider' };
  }

  if (wallet.id === 'onekey' && runtimeId === 'onekey-webusb') {
    return { kind: 'onekey-webusb', transport: 'webusb' };
  }

  if (wallet.id === 'secux' && runtimeId === 'secux-webusb') {
    return { kind: 'secux-webusb', transport: 'webusb' };
  }

  return null;
}

function createSignerForRuntime(options: {
  walletId: Wallet['id'];
  runtime: HWSignerRuntime;
  onEvent?: Parameters<typeof createHWSigner>[0]['onEvent'];
}): WalletAdapter {
  return isReactNativeRuntime(options.runtime)
    ? createReactNativeHWSigner(options)
    : createHWSigner(options);
}

function isReactNativeRuntime(runtime: HWSignerRuntime): boolean {
  return runtime.kind === 'tangem-react-native-nfc'
    || runtime.kind === 'react-native-walletconnect'
    || runtime.kind === 'react-native-keystone-qr';
}

function createNativePlaceholderWallet(walletName: string): Extract<HWSignerRuntime, { kind: 'react-native-keystone-qr' }>['wallet'] {
  const reject = async () => {
    throw new Error(`${walletName} React Native runtime needs an injected native wallet client.`);
  };

  return {
    publicKey: null,
    connect: reject,
    disconnect: reject,
    signMessage: reject,
    signTransaction: reject,
  };
}

function getUnavailableRuntimeMessage(runtime?: WalletRuntime): string {
  if (runtime?.localOnly) {
    return 'Speculos is local-only. Enable NEXT_PUBLIC_ENABLE_SPECULOS=true in development.';
  }

  if (runtime?.nativeOnly) {
    return 'This runtime belongs in a React Native iOS/Android app. Use the Code tab and inject the native wallet client or SDK there.';
  }

  return 'The selected runtime is not available yet.';
}

function toSdkCapabilities(wallet: Wallet): HWSignerCapabilities {
  return {
    connect: wallet.capabilities.connect,
    disconnect: wallet.capabilities.connect,
    getAccounts: wallet.capabilities.getAccounts,
    signMessage: wallet.capabilities.signMessage,
    signTransaction: wallet.capabilities.signTransaction,
    signVersionedTransaction: wallet.capabilities.signVersionedTransaction,
    emulator: wallet.capabilities.emulatorMode,
    usb: wallet.capabilities.usb,
    ble: wallet.capabilities.ble,
    qr: wallet.capabilities.qr,
    nfc: wallet.capabilities.nfc,
  };
}

function isSigningPayloadModeSupported(walletId: Wallet['id'], mode: TransactionSigningPayloadMode, runtime: HWSignerRuntime | null): boolean {
  if (
    walletId === 'keystone'
    || walletId === 'arculus'
    || walletId === 'bc-vault'
    || walletId === 'safepal'
    || walletId === 'coolwallet'
    || walletId === 'secux'
    || walletId === 'dcent'
    || walletId === 'ellipal'
    || walletId === 'solflare-shield'
    || walletId === 'gridplus-lattice'
    || walletId === 'keypal'
  ) {
    return mode === 'serialized-transaction';
  }

  if (walletId === 'tangem' && runtime?.kind === 'tangem-walletconnect') {
    return mode === 'serialized-transaction';
  }

  if (walletId === 'tangem') {
    return mode === 'legacy-message-bytes' || mode === 'versioned-message-bytes';
  }

  if (walletId === 'cypherock') {
    return mode === 'legacy-message-bytes';
  }

  return true;
}

type HighlightSegment = {
  text: string;
  className: string;
};

const codeKeywords = new Set([
  'import',
  'from',
  'const',
  'await',
  'async',
  'new',
  'return',
  'true',
  'false',
  'null',
  'as',
]);

const codeIdentifiers = new Set([
  'createHWSigner',
  'Connection',
  'PublicKey',
  'SystemProgram',
  'Transaction',
  'TransactionMessage',
  'VersionedTransaction',
  'connect',
  'getCapabilities',
  'getAccounts',
  'signMessage',
  'signTransaction',
  'signVersionedTransaction',
  'getLatestBlockhash',
  'compileToV0Message',
  'log',
]);

function highlightCode(code: string): HighlightSegment[][] {
  return code.split('\n').map((line) => tokenizeCodeLine(line));
}

function tokenizeCodeLine(line: string): HighlightSegment[] {
  const tokens: HighlightSegment[] = [];
  const pattern = /(\/\/.*$|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|`(?:\\.|[^`])*`|\b\d+(?:_\d+)*(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b|[{}()[\].,:;])/g;

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

  if (
    token.startsWith("'")
    || token.startsWith('"')
    || token.startsWith('`')
  ) {
    return 'text-emerald-300';
  }

  if (/^\d/.test(token)) {
    return 'text-amber-300';
  }

  if (codeKeywords.has(token)) {
    return 'text-sky-300';
  }

  if (token === 'console') {
    return 'text-purple-300';
  }

  if (codeIdentifiers.has(token)) {
    return 'text-cyan-300';
  }

  if (/^[{}()[\].,:;]$/.test(token)) {
    return 'text-slate-500';
  }

  return 'text-slate-100';
}
