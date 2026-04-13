const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function normalizeMessageBytes(message: string | Uint8Array): Uint8Array {
  return typeof message === 'string' ? encoder.encode(message) : message;
}

export function messageToDisplayText(message: string | Uint8Array): string {
  return typeof message === 'string' ? message : decoder.decode(message);
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(value, 'base64'));
  }

  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}