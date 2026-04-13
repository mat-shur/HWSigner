import { describe, expect, it } from 'vitest';

import { base64ToBytes, bytesToBase64, messageToDisplayText, normalizeMessageBytes } from './message';

describe('message helpers', () => {
  it('normalizes string messages into bytes', () => {
    expect(Array.from(normalizeMessageBytes('HWSigner'))).toEqual([72, 87, 83, 105, 103, 110, 101, 114]);
  });

  it('keeps binary payloads unchanged', () => {
    const payload = new Uint8Array([1, 2, 3, 4]);
    expect(normalizeMessageBytes(payload)).toBe(payload);
  });

  it('round-trips base64 helpers', () => {
    const payload = new Uint8Array([10, 20, 30, 40]);
    expect(base64ToBytes(bytesToBase64(payload))).toEqual(payload);
  });

  it('creates a readable preview for string messages', () => {
    expect(messageToDisplayText('Ledger')).toBe('Ledger');
  });
});