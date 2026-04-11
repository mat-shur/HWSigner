import { randomUUID } from 'node:crypto';

import type { DeviceManagementKit, DeviceSessionId } from '@ledgerhq/device-management-kit';

import { DeviceConnectionError } from '@/lib/hwsigner/errors';

export interface SpeculosSession {
  token: string;
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  speculosUrl: string;
  createdAt: number;
}

declare global {
  var __hwsignerSpeculosSessions: Map<string, SpeculosSession> | undefined;
}

export function saveSpeculosSession(session: Omit<SpeculosSession, 'token' | 'createdAt'>): SpeculosSession {
  const storedSession: SpeculosSession = {
    ...session,
    token: randomUUID(),
    createdAt: Date.now(),
  };

  getSpeculosSessionStore().set(storedSession.token, storedSession);
  return storedSession;
}

export function requireSpeculosSession(token: string): SpeculosSession {
  const session = getSpeculosSessionStore().get(token);

  if (!session) {
    throw new DeviceConnectionError('The Speculos session is missing or has expired.');
  }

  return session;
}

export function deleteSpeculosSession(token: string): SpeculosSession | undefined {
  const session = getSpeculosSessionStore().get(token);
  if (session) {
    getSpeculosSessionStore().delete(token);
  }

  return session;
}

export function clearSpeculosSessions() {
  getSpeculosSessionStore().clear();
}

function getSpeculosSessionStore(): Map<string, SpeculosSession> {
  globalThis.__hwsignerSpeculosSessions ??= new Map<string, SpeculosSession>();
  return globalThis.__hwsignerSpeculosSessions;
}
