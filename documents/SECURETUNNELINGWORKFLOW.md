# KNX Secure Tunneling Workflow

This document summarizes the end‑to‑end flow used by `SecureTunnelTCP` for KNX IP Secure session setup, tunneling, and KNX Data Secure payload protection. It also explains how sequence numbers are managed at each layer.

## Overview

- Transport: TCP to KNX/IP gateway on port 3671
- Protection layers:
  - KNX IP Secure Session (Secure Wrapper, 0x0950)
  - KNX Data Secure (SecureAPDU with APCI_SEC 0x03F1 + SCF 0x10)
  - KNX/IP Tunneling for bus frames (0x0420/0x0421)

## Session Establishment (KNX IP Secure)

1) TCP connect → gateway

2) Session Request (0x0951)
   - Client sends: HPAI + X25519 public key (32B)
   - Frame: `0610 | 0951 | len | HPAI | client_pubkey32`

3) Session Response (0x0952)
   - Gateway replies with: `sessionId` + server X25519 public key (32B)

4) Session Key Derivation
   - ECDH: `secret = X25519(client_priv, server_pub)`
   - `sessionKey = SHA256(secret)[0..15]` (128-bit AES key)

5) Session Authenticate (0x0953) [wrapped]
   - User key derivation: `userPasswordKey = PBKDF2(password, "user-password.1.secure.ip.knx.org", 65536, 16, sha256)`
   - AdditionalData: header(0953) + `00` + `userId` + XOR(client_pubkey, server_pubkey)
   - CBC‑MAC over `[block0=16 zeroes] + TL(additionalData) + additionalData` (no padding bytes in MAC; tail of CBC)
   - Transform MAC via AES‑CTR with IV `000..0ff00`
   - Send 0x0953 inside Secure Wrapper using `sessionKey`

6) Session Status (0x0954) [wrapped]
   - Expect status `0` (OK). If OK, proceed to tunneling

## Tunneling Channel (KNX/IP)

7) CONNECT_REQUEST (0x0205) [wrapped]
   - Body: HPAI control + HPAI data + CRD (link‑layer)

8) CONNECT_RESPONSE (0x0206) [wrapped]
   - Returns `channelId` and (often) assigned Individual Address (IA) in CRD

## Data Phase (KNX Data Secure over Tunneling)

Send path:
- Build plain APDU (e.g., GroupValueRead 0x0000, GroupValueWrite 0x0080 | value)
- Build SecureAPDU:
  - Use per‑sender 48‑bit Data Secure sequence (`seq48`, persisted)
  - Block0 for CBC‑MAC consists of:
    - `seq48(6)` + `srcIA(2)` + `dstGA(2)`
    - `00` + `(control2 & 0x8F)` + `((TPCI_DATA << 2) + 0x03)` + `0xF1` + `00` + `len(payload)`
  - MAC‑CBC over `SCF(0x10) + payload` with `block0`; take 4 bytes
  - CTR counter0: `seq48 + srcIA + dstGA + 00 00 00 00 01 00`
  - Encrypt payload with CTR, transform MAC4 with CTR
  - SecureAPDU = `[0x03, 0xF1] + [0x10] + seq48 + encPayload + encMac4`
- Pack into cEMI L_DATA_REQ and KNX/IP TUNNELING_REQUEST (with connection header)
- Send inside Secure Wrapper (0x0950)

Receive path:
- On inbound TUNNELING_REQUEST: send TUNNELING_ACK
- Extract cEMI → if SecureAPDU:
  - Derive `counter0` and decrypt payload/mac
  - Rebuild `block0` and recompute 4‑byte MAC; verify
  - Parse APCI (e.g., Read/Response/Write) and value (1‑bit for DPT_Switch)

## Sequence Numbers

- Secure Wrapper sequence (6 bytes, per session):
  - Purpose: forms nonces/IVs for encrypting Secure Wrapper content
  - Scope: increments per wrapped frame; not persisted; resets on new session

- Tunneling sequence (1 byte):
  - Purpose: correlates TUNNELING_REQUEST with TUNNELING_ACK
  - Scope: per channel, wraps at 256

- Data Secure sender sequence `seq48` (6 bytes, persisted):
  - Purpose: anti‑replay and cryptographic nonce for Data Secure
  - Used in MAC‑CBC `block0` and CTR `counter0`
  - Persisted across runs; monotonic increasing
  - Initialization: time‑based (ms since 2018‑01‑05) if no persisted store exists

## Timeouts (defaults)

- Session Response wait: 5s
- Session Status wait: 5s
- Connect Response wait: 15s

## ASCII Flow

```
Client                                            Gateway
  |------------------ TCP connect ------------------>|
  | 0951 SECURE_SESSION_REQUEST (HPAI + pubkey)      |
  |<----- 0952 SECURE_SESSION_RESPONSE (sid + pk) ---|
  |  -- derive sessionKey via ECDH + SHA256 --       |
  | wrap(0953 SECURE_SESSION_AUTHENTICATE) --------->|
  |<---- wrap(0954 SECURE_SESSION_STATUS=OK) --------|
  | wrap(0205 CONNECT_REQUEST) --------------------->|
  |<--- wrap(0206 CONNECT_RESPONSE, channelId, IA) --|
  |                                                  |
  | wrap(0420 TUNNELING_REQUEST: cEMI L_DATA_REQ     |
  |   SecureAPDU(seq48, encPayload, mac4)) --------->|
  |<-------- wrap(0421 TUNNELING_ACK, seq8) ---------|
  |<-- wrap(0420 TUNNELING_REQUEST: incoming cEMI ---|
  | wrap(0421 TUNNELING_ACK) ----------------------->|
```

## Notes and Code Anchors

- Session and tunneling in: `src/secure/SecureTunnelTCP.ts`
 - Constants: `src/secure/secure_knx_constants.ts`
 - Keyring parsing: `src/secure/keyring.ts`
