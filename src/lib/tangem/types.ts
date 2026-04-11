export interface TangemReactNativeSdk {
  startSession?: (config?: TangemSessionConfig) => unknown | Promise<unknown>;
  stopSession?: () => unknown | Promise<unknown>;
  scanCard?: () => unknown | Promise<unknown>;
  sign?: (input: TangemSignInput) => unknown | Promise<unknown>;
  getNFCStatus?: () => unknown | Promise<unknown>;
}

export interface TangemSessionConfig {
  attestationMode?: 'offline' | 'online' | string;
  defaultDerivationPaths?: string | string[];
}

export interface TangemSignInput {
  cardId: string;
  hashes: string[];
}

export interface TangemCardSession {
  cardId: string;
  address: string;
  derivationPath: string;
}
