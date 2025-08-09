/**
 * Minimal helpers to construct/parse KNXnet/IP frames for secure tunneling.
 * NOTE: These are STUBS. Replace header fields/offsets with the official spec.
 */

export interface KnxHeaderFields {
  serviceType: number;   // e.g., 0x0420 for TUNNELING_REQUEST (check spec)
  channelId: number;
  sequence: number;      // KNXnet/IP sequence (not the secure seq)
  // ...other fields as needed
}

/** Build the AAD from KNXnet/IP header fields (without encrypted body). */
export function buildKnxHeaderForAAD(h: KnxHeaderFields): Buffer {
  // TODO: build the exact header bytes that must be authenticated (AAD)
  const buf = Buffer.alloc(8);
  buf.writeUInt16BE(h.serviceType, 0);
  buf.writeUInt8(h.channelId & 0xff, 2);
  buf.writeUInt8(h.sequence & 0xff, 3);
  // pad / add fields as required by the spec
  return buf;
}

/** Wrap securePayload into a KNXnet/IP "Secure" frame. */
export function buildKnxSecureFrame(h: KnxHeaderFields, securePayload: Buffer): Buffer {
  const aad = buildKnxHeaderForAAD(h);
  const totalLength = aad.length + securePayload.length + 6; // 6 = example header bytes (stub)
  const out = Buffer.alloc(6);
  // Common KNXnet/IP header parts (STUB):
  out.writeUInt8(0x06, 0); // header size?
  out.writeUInt8(0x10, 1); // protocol version?
  out.writeUInt16BE(h.serviceType, 2);
  out.writeUInt16BE(totalLength, 4);
  return Buffer.concat([out, aad, securePayload]);
}

/** Parse a KNXnet/IP frame into { aad, securePayload } for decryption. */
export function parseSecureKnxFrame(frame: Buffer): { aad: Buffer; securePayload: Buffer } {
  if (frame.length < 6) throw new Error("Frame too short");
  const totalLength = frame.readUInt16BE(4);
  if (totalLength !== frame.length) {
    // some stacks may have padding; adapt if needed
  }
  // STUB: assume next bytes after the 6-byte header are the AAD (8 bytes as in buildKnxHeaderForAAD)
  const aadLen = 8;
  if (frame.length < 6 + aadLen + 1) throw new Error("Frame too short for AAD");
  const aad = frame.subarray(6, 6 + aadLen);
  const securePayload = frame.subarray(6 + aadLen);
  return { aad, securePayload };
}
