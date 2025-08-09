# KNX/IP Secure Tunneling — Integration Notes

This PR adds a **TypeScript skeleton** to enable KNX/IP Secure (Tunneling only).

## What’s included
- AES-128-CCM helpers (`src/secure/ccm.ts`)
- Session & counters (`src/secure/session.ts`)
- Secure adapter for wrap/unwrap (`src/secure/adapter.ts`)
- Keyring loader (JSON, `src/secure/keyring.ts`)
- Frame helpers (stubs) (`src/secure/frame.ts`)
- TCP transport with reassembly (`src/transport/tcp-client.ts`)
- Types (`src/secure/types.ts`)
- Smoke test for CCM (`test/ccm-smoke.test.ts`)

## Next steps (TODO)
1. **Secure Wrapper Layout**
   - Confirm the exact field order/lengths for the secure wrapper around cEMI.
   - Replace the placeholder where we currently do `[seq(4B) | ciphertext | tag]`.
2. **AAD Definition**
   - Confirm which KNXnet/IP header bytes must be included as AAD (spec requirement).
   - Update `buildKnxHeaderForAAD` and `parseSecureKnxFrame` accordingly.
3. **Nonce Format**
   - Align nonce = saltTX/saltRX + (seq or fields required by spec).
   - Update `KnxSecureSession.buildNonceTX/RX` to match the standard.
4. **KDF (manual path)**
   - If not using ETS keyring-provided tunnel keys, implement the official KDF based on commissioning/auth material.
5. **Handshake (if required by target device)**
   - Add `secure/handshake.ts` to perform any secure hello/exchange expected by the gateway.
6. **.knxkeys XML Support**
   - Add XML parsing (e.g., `xml2js`) and normalize to `KeyringObject`.

## How to wire in the client
- Use `TcpTunnelingClient` when `secure===true`.
- After `CONNECT_REQUEST/RESPONSE`, init session & adapter from keyring (preferred).
- On send: build AAD → `wrapTunnelingRequest` → `buildKnxSecureFrame` → `tcp.send`.
- On receive: `parseSecureKnxFrame` → `unwrapSecurePayload` → handle plain cEMI.

## Tests
- Run `test/ccm-smoke.test.ts` to validate AES-CCM roundtrip.
- Add device integration tests once wrapper/AAD/nonce are finalized.

---

> Once we lock the exact wrapper/AAD/nonce from a known-good device capture, I’ll update the offsets and remove the TODOs.
