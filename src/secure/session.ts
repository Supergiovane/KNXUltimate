import { TunnelKeys } from "./types";

/**
 * Manages keys, counters and nonce building for TX/RX.
 * TODO: align nonce format to KNX/IP Secure Tunneling.
 */
export class KnxSecureSession {
  private keyTX: Buffer;
  private keyRX: Buffer;
  private saltTX: Buffer;
  private saltRX: Buffer;
  private tagLength: number;

  private seqTX = 0 >>> 0;
  private seqRX = 0 >>> 0;

  constructor(keys: TunnelKeys) {
    this.keyTX = keys.keyTX;
    this.keyRX = keys.keyRX;
    this.saltTX = keys.nonceSaltTX;
    this.saltRX = keys.nonceSaltRX;
    this.tagLength = keys.tagLength ?? 16;
    if (this.keyTX.length !== 16 || this.keyRX.length !== 16) {
      throw new Error("KNX Secure: keys must be 16 bytes (AES-128).");
    }
  }

  public nextSeqTX(): number {
    const s = this.seqTX >>> 0;
    this.seqTX = (this.seqTX + 1) >>> 0;
    return s;
  }

  public get rxCounter(): number { return this.seqRX >>> 0; }

  public acceptAndAdvanceRX(seq: number): void {
    if ((seq >>> 0) < (this.seqRX >>> 0)) {
      throw new Error("KNX Secure: replay detected (seq out of order).");
    }
    this.seqRX = (seq + 1) >>> 0;
  }

  public buildNonceTX(seq: number): Buffer {
    const n = Buffer.alloc(12);
    this.saltTX.copy(n, 0, 0, Math.min(8, this.saltTX.length));
    n.writeUInt32BE(seq >>> 0, 8);
    return n;
  }

  public buildNonceRX(seq: number): Buffer {
    const n = Buffer.alloc(12);
    this.saltRX.copy(n, 0, 0, Math.min(8, this.saltRX.length));
    n.writeUInt32BE(seq >>> 0, 8);
    return n;
  }

  public get txKey(): Buffer { return this.keyTX; }
  public get rxKey(): Buffer { return this.keyRX; }
  public get authTagLen(): number { return this.tagLength; }
}
