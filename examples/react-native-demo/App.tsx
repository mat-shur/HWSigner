import React, { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { createPlaygroundTransaction } from 'hwsigner/core';
import {
  createReactNativeHWSigner,
  type HWSignerEvent,
  type HWWalletId,
  type WalletAdapter,
} from 'hwsigner/react-native';

import {
  keystoneQrClient,
  requireConfiguredClient,
  tangemSdk,
  walletConnectClient,
} from './src/configureNativeClients';

type DemoWallet = {
  id: HWWalletId;
  name: string;
  createSigner: (onEvent: (event: HWSignerEvent) => void) => WalletAdapter;
};

const wallets: DemoWallet[] = [
  {
    id: 'tangem',
    name: 'Tangem NFC',
    createSigner: (onEvent) =>
      createReactNativeHWSigner({
        walletId: 'tangem',
        runtime: {
          kind: 'tangem-react-native-nfc',
          transport: 'nfc',
          sdk: requireConfiguredClient(tangemSdk, 'Tangem SDK'),
        },
        onEvent,
      }),
  },
  {
    id: 'keystone',
    name: 'Keystone QR',
    createSigner: (onEvent) =>
      createReactNativeHWSigner({
        walletId: 'keystone',
        runtime: {
          kind: 'react-native-keystone-qr',
          transport: 'qr',
          wallet: requireConfiguredClient(keystoneQrClient, 'Keystone QR client'),
          walletName: 'Keystone',
        },
        onEvent,
      }),
  },
  {
    id: 'dcent',
    name: "D'CENT WalletConnect",
    createSigner: (onEvent) =>
      createReactNativeHWSigner({
        walletId: 'dcent',
        runtime: {
          kind: 'react-native-walletconnect',
          transport: 'deep-link',
          wallet: requireConfiguredClient(walletConnectClient, 'WalletConnect client'),
          walletName: "D'CENT",
        },
        onEvent,
      }),
  },
];

export default function App() {
  const [selectedId, setSelectedId] = useState<HWWalletId>('tangem');
  const [events, setEvents] = useState<string[]>([]);
  const [accountAddress, setAccountAddress] = useState<string | null>(null);

  const selectedWallet = useMemo(
    () => wallets.find((wallet) => wallet.id === selectedId) ?? wallets[0],
    [selectedId],
  );

  const addEvent = (message: string) => {
    setEvents((current) => [`${new Date().toLocaleTimeString()} ${message}`, ...current].slice(0, 20));
  };

  const createSigner = () =>
    selectedWallet.createSigner((event) => {
      addEvent(event.message);
    });

  const runConnect = async () => {
    try {
      const signer = createSigner();
      const connection = await signer.connect();
      const accounts = await signer.getAccounts({ startIndex: 0, count: 1 });
      setAccountAddress(accounts[0]?.address ?? null);
      addEvent(`Connected to ${connection.walletName}.`);
    } catch (error) {
      addEvent(getErrorMessage(error));
    }
  };

  const runSignMessage = async () => {
    try {
      const signer = createSigner();
      const result = await signer.signMessage({
        accountIndex: 0,
        message: 'Hello from HWSigner React Native demo',
      });
      setAccountAddress(result.address);
      addEvent(`Message signed: ${result.signature}`);
    } catch (error) {
      addEvent(getErrorMessage(error));
    }
  };

  const runSignTransaction = async () => {
    try {
      if (!accountAddress) {
        throw new Error('Connect and derive an account before signing a transaction.');
      }

      const signer = createSigner();
      const transaction = createPlaygroundTransaction({ fromAddress: accountAddress });
      const result = await signer.signTransaction({
        accountIndex: 0,
        transaction,
      });
      addEvent(`Transaction signed: ${result.signature}`);
    } catch (error) {
      addEvent(getErrorMessage(error));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>HWSigner React Native</Text>
        <Text style={styles.title}>Injected-client hardware wallet demo</Text>
        <Text style={styles.copy}>
          Pick a runtime, wire its native client, then run the same connect, message signing, and
          transaction signing calls.
        </Text>

        <View style={styles.walletRow}>
          {wallets.map((wallet) => (
            <TouchableOpacity
              key={wallet.id}
              onPress={() => setSelectedId(wallet.id)}
              style={[styles.walletButton, wallet.id === selectedId && styles.walletButtonActive]}
            >
              <Text style={styles.walletButtonText}>{wallet.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{selectedWallet.name}</Text>
          <Text style={styles.account}>{accountAddress ?? 'No account connected yet.'}</Text>
          <TouchableOpacity style={styles.actionButton} onPress={runConnect}>
            <Text style={styles.actionButtonText}>Connect and get account</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={runSignMessage}>
            <Text style={styles.actionButtonText}>Sign message</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={runSignTransaction}>
            <Text style={styles.actionButtonText}>Sign transaction</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Event log</Text>
          {events.length === 0 ? (
            <Text style={styles.copy}>No events yet.</Text>
          ) : (
            events.map((event, index) => (
              <Text key={`${event}-${index}`} style={styles.event}>
                {event}
              </Text>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown React Native demo error';
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#050814',
  },
  container: {
    gap: 18,
    padding: 24,
  },
  eyebrow: {
    color: '#14F195',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 30,
    fontWeight: '800',
  },
  copy: {
    color: '#CBD5E1',
    fontSize: 15,
    lineHeight: 22,
  },
  walletRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  walletButton: {
    borderColor: '#334155',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  walletButtonActive: {
    borderColor: '#14F195',
    backgroundColor: '#0F2A24',
  },
  walletButtonText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    borderColor: '#223047',
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 18,
    backgroundColor: '#0B1220',
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  account: {
    color: '#94A3B8',
    fontSize: 13,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#14F195',
    borderRadius: 14,
    paddingVertical: 12,
  },
  actionButtonText: {
    color: '#04110D',
    fontSize: 14,
    fontWeight: '800',
  },
  event: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 18,
  },
});
