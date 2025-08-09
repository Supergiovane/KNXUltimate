import fs from "node:fs";
import { KeyringObject, SecureParamsManual, TunnelKeys } from "./types";

/** Loads a .knxkeys JSON. XML parsing not implemented yet. */
export function loadKeyring(path: string): KeyringObject {
  const raw = fs.readFileSync(path, "utf8");
  try {
    const obj = JSON.parse(raw);
    return obj as KeyringObject;
  } catch {
    throw new Error("Keyring XML parsing not yet implemented (expects JSON).");
  }
}

/** Resolve tunnel keys by userId/Individual Address. */
export function resolveTunnelKeys(
  keyring: KeyringObject,
  params: SecureParamsManual
): TunnelKeys {
  const cand = keyring.tunnels.find(t =>
    t.userId === params.tunnelUserId &&
    (!params.deviceIndividualAddress || t.individualAddress === params.deviceIndividualAddress)
  );
  if (!cand) {
    throw new Error("KNX Secure: matching tunnel not found in keyring.");
  }
  if (!cand.keyTXHex || !cand.keyRXHex || !cand.nonceSaltTXHex || !cand.nonceSaltRXHex) {
    throw new Error("KNX Secure: incomplete tunnel entry (keys/salts missing).");
  }
  return {
    keyTX: Buffer.from(cand.keyTXHex, "hex"),
    keyRX: Buffer.from(cand.keyRXHex, "hex"),
    nonceSaltTX: Buffer.from(cand.nonceSaltTXHex, "hex"),
    nonceSaltRX: Buffer.from(cand.nonceSaltRXHex, "hex"),
    tagLength: cand.tagLength ?? 16,
  };
}

/** Manual derivation placeholder. Replace with spec KDF. */
export function deriveFromManual(params: SecureParamsManual): TunnelKeys {
  if (!params.authCodeHex) {
    throw new Error("KNX Secure: authCodeHex required for manual derivation (TODO KDF).");
  }
  const base = Buffer.from(params.authCodeHex, "hex");
  if (base.length < 16) throw new Error("authCodeHex too short");
  const keyTX = base.subarray(0, 16);
  const keyRX = base.subarray(0, 16);
  const saltTX = (base.length >= 24) ? base.subarray(16, 24) : Buffer.concat([base.subarray(0, 8)]);
  const saltRX = (base.length >= 32) ? base.subarray(24, 32) : Buffer.concat([base.subarray(0, 8)]);
  return { keyTX, keyRX, nonceSaltTX: saltTX, nonceSaltRX: saltRX, tagLength: 16 };
}
