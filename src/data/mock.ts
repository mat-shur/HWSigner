import { DEFAULT_PLAYGROUND_LAMPORTS, DEFAULT_PLAYGROUND_RECIPIENT } from '@/lib/hwsigner/transactions';

export const playgroundDefaults = {
  deriveCount: 3,
  message: 'Sign this message to verify ownership of your hardware wallet.',
  transactionRecipient: DEFAULT_PLAYGROUND_RECIPIENT,
  transactionLamports: DEFAULT_PLAYGROUND_LAMPORTS,
};

export type EventLogEntry = {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'warning' | 'action';
  message: string;
};

export const createEvent = (type: EventLogEntry['type'], message: string): EventLogEntry => ({
  id: Math.random().toString(36).slice(2),
  timestamp: new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }),
  type,
  message,
});
