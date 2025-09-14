# KNX Secure Routing (Multicast) Workflow

This document summarizes the end‑to‑end flow used by KNX/IP Secure Routing over multicast (224.0.23.12). It covers the Secure Wrapper used on routing frames, timer synchronization, and optional KNX Data Secure for group addresses.

## Overview

- Transport: UDP multicast 224.0.23.12:3671
- Protection layers:
  - KNX IP Secure Wrapper (0x0950) for routing frames
  - Timer synchronization (0x0955) for secure routing
  - Optional KNX Data Secure (SecureAPDU) for protected GA

## Keys and Setup

- Requires the Backbone key in the ETS keyring. The client loads it from the keyring (first backbone entry) and uses it to decrypt/verify secure routing frames.
- There is no session handshake for routing; the Secure Wrapper is used with Session ID = 0.
- The client can optionally wait for a timer authentication before sending (`secureRoutingWaitForTimer`, default true).

## Timer Synchronization (0x0955)

1) TimerNotify (0x0955)
   - Gateway sends periodic messages containing a 48‑bit timer value.
   - The message includes a MAC which is verified using the Backbone key.
   - After a valid 0x0955 is received, the client marks the secure routing timer as authenticated and aligns its send‑time base (offset).

2) First Secure Frame (0x0950)
   - If `secureRoutingWaitForTimer` is enabled, the client defers sending any secure multicast until the timer is authenticated (either via 0x0955 or via a first valid wrapped frame).

## Secure Routing Wrapper (0x0950)

- Outbound frames are wrapped using the Backbone key:
  - Sequence: a 48‑bit value derived from the (authenticated) timer.
  - Session ID: 0 (routing).
  - Tag: 2 random bytes per frame.
  - Additional data: KNX/IP header + SessionID (00 00).
  - MAC computation: AES‑128‑CBC over `[seq | serial | tag | len(payload)] + TL(additionalData) + payload` (no padding in MAC extraction).
  - Transform MAC and payload with AES‑CTR using `counter0 = seq | serial | tag | ff 00`.

Receive path:
- On inbound 0x0950, the client reconstructs the blocks, verifies the MAC, and decrypts the payload using the Backbone key, then passes the inner KNX/IP frame (e.g., ROUTING_INDICATION 0x0530) to the normal pipeline.

## KNX Data Secure (optional)

- If Group Address keys are present in the ETS keyring, outgoing cEMI L_DATA_REQ for those GA are converted to SecureAPDU (APCI_SEC 0x03F1, SCF 0x10) before wrapping. The logic mirrors the TunnelTCP Data Secure path (seq48, block0, MAC‑CBC, AES‑CTR). GA without keys remain plain.

## Connection Semantics

- There is no CONNECT/ACK sequence in routing mode. The UDP socket binds and joins the multicast group; in plain mode the client emits `connected` on `listening`. In secure mode, if `secureRoutingWaitForTimer` is true, the client emits `connected` after the first timer authentication (0x0955 or first valid 0x0950).

## Sequence Numbers

- Secure Wrapper sequence (routing): derived from the monotonic timer; 48‑bit value used in nonces/IVs.
- Data Secure sender sequence `seq48` (per GA sender): 48‑bit counter used exactly as in TunnelTCP for SecureAPDU.

## ASCII Flow

```
Client (multicast)                                  Router
  |---------------- UDP bind+join (224.0.23.12) ------>|
  |<----------- 0955 TimerNotify (auth MAC) ---------- |
  |       (mark timer authenticated; compute offset)   |
  | 0950 SecureWrapper(0530 ROUTING_INDICATION:       |
  |   cEMI L_DATA_REQ [SecureAPDU if GA has key]) ---->|
  |<--------- 0950 SecureWrapper(0530 incoming) ------ |
```

## Notes and Code Anchors

- Implementation lives inline in the client: `src/KNXClient.ts` (search for "Secure Multicast" / `secureWrapRouting`, `secureDecryptRouting`)
- Crypto/constants: `src/secure/secure_knx_constants.ts`, `src/secure/security_primitives.ts`
- Keyring parsing: `src/secure/keyring.ts` (Backbone key, Group Address keys)

