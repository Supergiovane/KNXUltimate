import { KnxSecureSession } from "./session";
import { ccmEncrypt, ccmDecrypt } from "./ccm";

/**
 * Wraps/unwraps KNX Tunneling payloads using KNX/IP Secure.
 * AAD should be the KNXnet/IP header (without the encrypted body).
 * TODO: align wrapper layout with the official spec.
 */
export class SecureChannelAdapter {
  private readonly sess: KnxSecureSession;
  private readonly maxWindow = 4096;

  constructor(session: KnxSecureSession) {
    this.sess = session;
  }

  /** Produce secure payload from plain cEMI. */
  public wrapTunnelingRequest(plainCemi: Buffer, aad: Buffer | null): { seq: number; securePayload: Buffer } {
    const seq = this.sess.nextSeqTX();
    const nonce = this.sess.buildNonceTX(seq);
    const { ciphertext, tag } = ccmEncrypt(this.sess.txKey, nonce, aad, plainCemi, this.sess.authTagLen);
    const seqBuf = Buffer.allocUnsafe(4); seqBuf.writeUInt32BE(seq >>> 0, 0);
    // TODO: add Secure Header fields if required by the spec
    const securePayload = Buffer.concat([seqBuf, ciphertext, tag]);
    return { seq, securePayload };
  }

  /** Extract plain cEMI from secure payload. */
  public unwrapSecurePayload(securePayload: Buffer, aad: Buffer | null): { seq: number; plainCemi: Buffer } {
    if (securePayload.length < 4 + this.sess.authTagLen) {
      throw new Error("KNX Secure: secure payload too short.");
    }
    const seq = securePayload.readUInt32BE(0) >>> 0;
    if (seq + this.maxWindow < this.sess.rxCounter) {
      throw new Error("KNX Secure: frame exceeds RX window.");
    }
    const tag = securePayload.subarray(securePayload.length - this.sess.authTagLen);
    const ciphertext = securePayload.subarray(4, securePayload.length - this.sess.authTagLen);
    const nonce = this.sess.buildNonceRX(seq);
    const plainCemi = ccmDecrypt(this.sess.rxKey, nonce, aad, ciphertext, tag, this.sess.authTagLen);
    this.sess.acceptAndAdvanceRX(seq);
    return { seq, plainCemi };
  }
}
