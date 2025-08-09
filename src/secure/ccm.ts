import crypto from "node:crypto";

/** AES-128-CCM encrypt. `key` must be 16 bytes. */
export function ccmEncrypt(
  key: Buffer,
  nonce: Buffer,
  aad: Buffer | null,
  plaintext: Buffer,
  tagLen: number = 16
): { ciphertext: Buffer; tag: Buffer } {
  const cipher = crypto.createCipheriv("aes-128-ccm", key, nonce, { authTagLength: tagLen });
  if (aad && aad.length) cipher.setAAD(aad, { plaintextLength: plaintext.length });
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext, tag };
}

/** AES-128-CCM decrypt. Throws if auth fails. */
export function ccmDecrypt(
  key: Buffer,
  nonce: Buffer,
  aad: Buffer | null,
  ciphertext: Buffer,
  tag: Buffer,
  tagLen: number = 16
): Buffer {
  const decipher = crypto.createDecipheriv("aes-128-ccm", key, nonce, { authTagLength: tagLen });
  if (aad && aad.length) decipher.setAAD(aad, { plaintextLength: ciphertext.length });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
