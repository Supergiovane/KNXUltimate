export interface SecureParamsManual {
  tunnelUserId: number;
  deviceIndividualAddress?: string;
  authCodeHex?: string;
  commissioningPassword?: string;
}

export interface TunnelKeys {
  keyTX: Buffer;
  keyRX: Buffer;
  nonceSaltTX: Buffer;
  nonceSaltRX: Buffer;
  tagLength?: number;
}

export interface KeyringObject {
  tunnels: Array<{
    userId: number;
    individualAddress?: string;
    keyTXHex?: string;
    keyRXHex?: string;
    nonceSaltTXHex?: string;
    nonceSaltRXHex?: string;
    tagLength?: number;
  }>;
}
