---
applyTo: '**'
---

# GOAL
Create a KNX Secure stack in Node.js Typescript.
The project in Node.js will work if you follow these steps:

1. Install the required dependencies using npm.
2. Proceed by study KNX Secure stack, via files /documents/UNI1607607_EEN.rtf
3. Create a secure authenticated connection with the KNX Secure gateway using the provided keyring. USE ONLY KNX SECURE AND DATA SECURE, do not use plain knx.
4. Run the project and monitor the logs for any errors or successful connections.
5. Send a ON telegram (Datapoint 1.001) to the group address 1/1/1
6. Read the status on the group address 1/1/2 and expect a response telegram (it should be the same result "ON", it takes a few seconds)
7. Send a OFF telegram (Datapoint 1.001) to the group address 1/1/1
8. Read the status on the group address 1/1/2 and expect a response telegram (it should be the same result "OFF", it takes a few seconds)
9. If the point 5 to 8 are successful, the implementation is working correctly.

# Context:
The "documents" folder, which contains the instructions, the keyring to use, and all the necessary KNX Secure documentation.
You need to STUDY the code and understand how KNX Secure works.
The keyring file to use in all examples and tests is /documents/Secure Test.knxkeys with the password "passwordprogetto" It's located in the "documents" folder.
The KNX Secure gateway for TUNNELING has IP 192.168.1.4 and only accepts KNX Secure Tunneling connections on one of the tunnels made available by the gateway.


# Environment set up for KNX Secure
The KNX/IP Secure Gateway is correctly configured and reachable at the specified IP address. The actuator is properly integrated into the KNX network and responds to telegrams as expected.

# TROUBLESHOOTING
The file "ETS_REFERENCE_TELEGRAM_WORKING.xml", located in the "documents" folder, contains the resulting log from manual ETS activation of all points above from 5. to 8.
Remember: we are working on an open source public project, so each user can have different ETS configuration, so we cannot harcode anything.

# HOW TO PROCEED 
Study the guide "Practical Guide (for AI agents) - Creating KNX Secure telegrams" below
Proceed step by step by:
1. Develop the function to connect to the KNX/IP Secure Gateway and make a test file to check connectivity and basic functionality.
2. Implement the encryption functions needed to create KNX Secure telegrams and create a test file for them.
3. Create the functions to send and receive KNX Secure telegrams and create a test file for them.


# Practical Guide (for AI agents) - Creating KNX Secure telegrams

────────────────────────────────────────────────────────────────────────────────
0) Purpose and scope
This guide explains, in an operational way, how KNX Secure telegrams ARE BUILT (both Data Secure on TP/RF, and KNXnet/IP Secure on IP). It is designed for a "technical" AI agent implementing stacks or testing tools. It does not contain text from the standards, but SUMMARIZES them to guide correct implementation.

Reference standards (to know):
• EN ISO 22510: KNXnet/IP (KNX IP Secure recognized as ISO standard in 2019).
• EN 50090-3-4 (sometimes indicated as 4-3): extends KNX with Data Secure.
• Algorithms: AES-128 in CCM mode (ISO/IEC 18033-3).

Key points (high level):
• KNX Data Secure = protects TELEGRAMS between KNX devices on TP/RF/IP at APDU level (application data). Only the "payload" is encrypted; headers/addresses remain in clear but are MAC-protected.
• KNX IP Secure = encapsulates and protects on IP (tunneling/routing). Adds security header, sequence counter/identifier and uses AES-CCM for confidentiality + integrity.
• Anti-replay "Freshness": sequence counters (6 bytes on Data Secure) or identifiers/counters on IP Secure. Each receiver accepts only "new" values.

────────────────────────────────────────────────────────────────────────────────
1) Minimal terminology
• APDU: Application Protocol Data Unit (e.g. GroupValue_Write + DPT payload).
• AAD (Additional Authenticated Data): fields NOT encrypted but authenticated in CCM.
• MIC (Message Integrity Code) or "Tag": authenticator produced by CCM (8...16 bytes).
• Security Control Field: control byte(s) indicating security version/flags.
• Sequence Number (Data Secure): 6 bytes for anti-replay, monotonic for each source.
• FDSK / Device Certificate: credentials for initializing Secure devices in ETS.
• ETS Keyring: export of secrets (runtime keys, etc.) from the ETS project.

────────────────────────────────────────────────────────────────────────────────
2) Keys and state needed BEFORE building a telegram
2.1 KNX Data Secure (runtime)
• For EACH protected group address, ETS generates a "Group Address Key" (AES-128 symmetric key). It is loaded into devices during commissioning.
• Each SOURCE maintains a 6-byte Sequence Number (persistent). It must be strictly monotonic for each destination/group according to device policy. The receiver stores the last seen for that source (and typically for that GA).
• Some vendors distinguish keys: "Sender Authentication Key" and "Group Address Encryption Key" for authentication and confidentiality. In practice, runtime keys are in the ETS export (Keyring/Security report).

2.2 KNX IP Secure (comm./runtime)
• Commissioning: ETS authenticates devices with Device Certificate/FDSK and can use ECDH (Curve25519) to derive session keys during commissioning.
• Secure tunneling (unicast): normally maintains a session state (key, sequence counter/ID) for each channel.
• Secure routing (multicast): uses shared key(s) configured on routers; there is also a "freshness" mechanism (identifier/counter) and a security header.

MOST IMPORTANT: sequence counters MUST survive restarts (NVRAM). Reusing a {key, nonce} pair in CCM compromises security.

────────────────────────────────────────────────────────────────────────────────
3) KNX Data Secure - how the telegram IS BUILT (TP/RF/IP as medium)
Objective: take a "clear" KNX telegram and transform it into the "secure" equivalent by encrypting ONLY the payload (APDU) and signing the relevant fields.

Operational steps (TX - sender side):
(DS-1) Prepare the "clear" telegram
  • Compose the standard KNX frame with:
    - Control Field 1
    - Source Individual Address (2 bytes)
    - Destination = Group Address (2 bytes + 1 type bit)
    - Control Field 2 (includes Routing Counter/Hop Count, APDU length, etc.)
    - APDU (e.g. Service + DPT data)
  • DO NOT send: we will use this structure to define AAD and Plaintext.

(DS-2) Sequence Number (6 bytes)
  • Read/increment the persistent counter for THIS source (and GA).
  • NEVER reuse an already transmitted value. NEVER decrement.
  • If exhausted → change key/re-commission.

(DS-3) Build the Security Control Field
  • Set version and flags for "cipher + auth" according to KNX Data Secure.
  • This field goes in the frame and participates in the calculation (see AAD/nonce).

(DS-4) Define the AAD (Additional Authenticated Data)
  • Include header fields that MUST remain unchanged end-to-end (at least: Source Address, Destination/Group Address, non-variable parts of Control Fields, Security Control Field).
  • Exclude bits that couplers can legitimately modify in transit (e.g. Hop Count, Repetition bit), otherwise the MAC will be invalid after routing.
  • Purpose: if someone alters addresses or lengths, the MIC will not verify.

(DS-5) Define Plaintext to encrypt
  • Plaintext = only the APDU (command + DPT data). Headers remain in clear.
  • Advantage: couplers can route without decrypting.

(DS-6) Build the CCM Nonce (typically 13 bytes)
  • Deterministic nonce derived from: Source Individual Address, Sequence Number (6 bytes) and security flag/variant (Security Control). Size/order are defined by the standard.
  • Property: for the same key it must NEVER repeat (freshness guaranteed by counter).

(DS-7) Execute AES-CCM
  • Key: Group Address Key (AES-128).
  • Input: (key, nonce, plaintext=APDU, aad, tagLen).
  • tagLen: according to specification/product (common 8 or 16 bytes). Choose the value expected by the device/stack you're interoperating with.
  • Output: ciphertext (encrypted APDU) + MIC (tag).

(DS-8) Assemble the KNX Data Secure frame
  • Serialize in the expected order: "plain" KNX header, Security Control Field, Sequence Number (6 bytes), Ciphertext(APDU), MIC(tag), then link layer FCS.
  • Check length: frames become "Extended" (up to ≈263 bytes). Ensure the USB/IP interface supports extended frames.

(DS-9) Update persistent state
  • Write new Sequence Number to NVRAM. In case of crash, it must not go backwards.

Operational steps (RX - receiver side):
(DS-10) Pre-check & Freshness
  • Extract Security Control & Sequence Number. Reject if SN ≤ last accepted for that source (and GA).

(DS-11) Reconstruct AAD and Nonce
  • Use the same fields/order as sender (invariants + control).

(DS-12) AES-CCM Decrypt+Verify
  • Input: key (GA key), nonce, ciphertext, aad, tag.
  • If MIC verification fails → DROP.
  • If ok → obtain "clear" APDU, recompose classic telegram and deliver to application stack.

(DS-13) Update acceptance window
  • Update the Sequence Number "last seen" (possible windowing for minimal reordering).

Critical implementation notes (Data Secure):
• The Sequence Number is 6 bytes (48 bits). Mandatory persistence (file/flash). Resets ⇨ nonce reuse risk: mitigate with factory reset/re-commissioning.
• Couplers decrement Hop Count and can set the Repetition bit: DO NOT include these bits in AAD (or include them in a form that doesn't invalidate the MIC after forwarding).
• The key for GA is different for each secure GA. ETS creates and loads them into devices; visible in the project's Security report.
• Pay attention to alignment, endianness and cEMI formats when working on IP/USB side.

────────────────────────────────────────────────────────────────────────────────
4) KNX IP Secure - how the secure payload IS BUILT (tunneling/routing)
Objective: encapsulate KNX data (e.g. cEMI/APDU) in a KNXnet/IP Secure container with anti-replay and CCM protection.

Operational steps (general):
(IP-1) Key and sequence state
  • Tunneling (unicast): session key derivation/negotiation during commissioning (ETS uses ECDH Curve25519). Each channel maintains a sequence counter/identifier.
  • Routing (multicast): backbone key(s) configured in routers; there is a shared SID/counter/freshness logic.

(IP-2) Build Security Header (KNXnet/IP Secure)
  • Include Security Control/Version and the required sequence Identifier/Counter.

(IP-3) Define AAD
  • Typically: KNXnet/IP Secure headers that MUST remain in clear (header/length etc.) to allow IP routing. (The APDU remains in the "protected data".)

(IP-4) Define Plaintext
  • Plaintext = KNXnet/IP portion to protect (e.g. cEMI block or tunneling payload).

(IP-5) Build CCM Nonce
  • Deterministic from: session/origin identifiers + counter/time + flag (exact mapping per standard). Uniqueness guaranteed by counter per key.

(IP-6) AES-CCM (AES-128)
  • Input: key (session or backbone), nonce, plaintext, aad, tagLen (8 or 16 according to implementation).
  • Output: ciphertext + MIC.

(IP-7) Assemble the KNXnet/IP Secure packet
  • KNXnet/IP header → Security Header (incl. seq) → ciphertext → MIC.

(IP-8) RX side verification
  • Freshness check (seq/SID) ⇨ reconstruct nonce ⇨ CCM decrypt+verify ⇨ deliver cEMI/APDU to stack.

Critical implementation notes (IP Secure):
• Secure commissioning uses ECDH (Curve25519) to generate temporary keys during configuration via ETS; then runtime keys are used for communication.
• CCM = CTR (encryption) + CBC-MAC (integrity). NEVER reuse (key, nonce).
• If also implementing ROUTING: manage clock/counter and re-synchronization to avoid anti-replay false positives on multicast.

────────────────────────────────────────────────────────────────────────────────
5) "Algorithmic" pseudo-flow (language independent)

// *** DATA SECURE - TRANSMISSION ***
INPUT: hdr_plain (CF1, src, dst, CF2 partial), apdu_plain, GA_key, seq6 (persistent), scf (security control), tagLen
AAD   = buildAAD(hdr_plain, scf)            // excludes mutable bits (hop count, repetition)
NONCE = buildNonce(src, seq6, scf)           // 13 deterministic bytes
CT, TAG = AES_CCM_Encrypt(GA_key, NONCE, apdu_plain, AAD, tagLen)
FRAME = serialize(hdr_plain, scf, seq6, CT, TAG, FCS)
persist(seq6+1)

// *** DATA SECURE - RECEPTION ***
parse FRAME → hdr_plain, scf, seq6, CT, TAG
if !fresh(seq6, src): drop
AAD   = buildAAD(hdr_plain, scf)
NONCE = buildNonce(src, seq6, scf)
apdu  = AES_CCM_Decrypt(GA_key, NONCE, CT, AAD, TAG)
if fail: drop
deliver(hdr_plain, apdu)

// *** IP SECURE - TRANSMISSION (TUNNELING) ***
INPUT: ip_hdr, knx_hdr, payload_cEMI, sess_key, sess_seq, scf_ip, tagLen
AAD   = buildAAD(ip_hdr, knx_hdr, scf_ip)
NONCE = buildNonce_IP(sess_id/origin, sess_seq, scf_ip)
CT, TAG = AES_CCM_Encrypt(sess_key, NONCE, payload_cEMI, AAD, tagLen)
PKT = serialize(ip_hdr, knx_hdr, scf_ip, sess_seq, CT, TAG)
persist(sess_seq+1)

────────────────────────────────────────────────────────────────────────────────
6) Pitfalls and best practices
• Counter persistence: mandatory. Use monotonic writes (journaling) to avoid rollback on crash/power-loss.
• Anti-replay window: provide a window (e.g. 16...64) to tolerate minimal reordering; NEVER accept already seen SN.
• Tag length: 8 bytes reduces overhead but lowers security margin; 16 is more robust. Follow the specification/product you must interoperate with.
• Couplers and MAC: remember that some bits can change in transit; AAD must exclude them or handle them as specified by the standard.
• Extended frames: verify that the interface supports lengths up to ~263 bytes (adequate ETS/IP/USB).
• Reset/factory reset: in case of "Implausible Secure Sequence Number" a reset and new commissioning may be needed.
• Keyring hardening: protect the ETS export (password, secure storage).

────────────────────────────────────────────────────────────────────────────────
7) Useful public references (non-normative, for guidance)
• KNX IP Secure recognized as EN ISO 22510 (2019): knx.org newsroom.
• KNX Data Secure: KNX support pages + ABB/Gira guides (6-byte sequence number; only APDU encrypted; extended frames; CCM AES-128).
• KNX IP Secure commissioning: ETS uses ECDH (Curve25519) for temporary key; runtime protected with CCM (CTR + CBC-MAC).

Note: exact details of bit layout (field order in nonce, Security Control sub-fields, precise AAD formats) are defined in standards and vendor documentation. For certain interoperability, always align to EN ISO 22510 / EN 50090-3-4 and device implementation specifications.

────────────────────────────────────────────────────────────────────────────────
8) Quick checklist (Data Secure) - TX construction
[ ] I have the correct Group Address Key for that GA
[ ] 6-byte persistent Sequence Number read and incremented
[ ] I set Security Control (cipher+auth) with correct version
[ ] I built AAD without including mutable bits (hop/repetition)
[ ] 13-byte unique Nonce (src+seq+flag) ready
[ ] AES-CCM executed with tagLen expected by peer
[ ] Frame assembled (plain header + SCF + SN + CT + TAG + FCS)
[ ] SN written to NVRAM

────────────────────────────────────────────────────────────────────────────────
9) Frequently asked questions (synthetic FAQ)
Q: How long is the Sequence Number in Data Secure?
A: 6 bytes (48 bits), monotonic and persistent. Also used to create the CCM nonce.

Q: What does Data Secure encrypt?
A: Only the APDU (payload). Headers remain in clear but authenticated via MAC.

Q: What algorithm does KNX Secure use?
A: AES-128 in CCM mode (CTR for encryption + CBC-MAC for authentication).

Q: Is it necessary to include Hop Count in AAD?
A: No, because it can be decremented by couplers; including it would make the MIC fail after forwarding. Use only end-to-end unchanged fields.

Q: Can I reuse a Sequence Number?
A: Never. If it happens, you break the security guarantee (nonce reuse in CCM).

────────────────────────────────────────────────────────────────────────────────
11) Extra section - LOW-LEVEL details (exemplary bit/byte layout)

A) KNX DATA SECURE - TELEGRAM
Format of a KNX frame (simplified) with Data Secure extensions:

Byte offset (typical example):
  0:   Control Field 1 (1 byte)
  1-2: Source Address (2 bytes, Individual Addr)
  3-4: Destination Address (2 bytes, Group or Individual)
  5:   Control Field 2 (1 byte: length = payload+checksum)
  6…n: Payload (APDU) or Security block

If Data Secure active, the payload changes like this:

  6:   Security Control Field (1 byte)
  7-12: Sequence Number (6 bytes, typically big-endian)
  13…m: Ciphertext (encrypted APDU) - length = len(APDU)
  m+1…m+T: MIC (Message Integrity Code, T=8 or 16 bytes)
  Last: FCS (1 byte, Frame Check Sequence CRC8)

Example Security Control Field (bits):
  Bit7-4: Version (e.g. 0001 = v1)                    [TO VERIFY]
  Bit3:   Reserved / future
  Bit2:   Authentication active?                      [1 = authenticate]
  Bit1:   Encryption active?                          [1 = encrypt]
  Bit0:   Other flag (e.g. frame type)

Example practice: SCF = 0x68 (bin 0110 1000) → v1 + C + A (exemplary template).
Use the exact values required by the device/stack you must interoperate with.

Sequence Number (6 bytes):
  • Monotonic for source+GA
  • Big-endian: SN[0] MSB … SN[5] LSB (verify with spec!)

CCM Nonce (typical 13 bytes):
  [ 2 bytes SrcAddr ][ 6 bytes SeqNum ][ 1 byte SCF ][ 4 bytes optional padding ]
  → Must match TX/RX.

AAD (Authenticated Data):
  [ ControlField1 | Src | Dst | CF2 partial | SecurityControl ]
  Exclude HopCount/Repetition because they can change.

Plaintext → original APDU (e.g. 0x11 0x00 = GroupValue_Write OFF)
Ciphertext → AES-CCM(Plaintext) with MIC

────────────────────────────────────────────────────────────────────────────────
B) KNX IP SECURE - TELEGRAM (TUNNELING UNICAST)

Typical KNXnet/IP Header:
  0-1:   Header Length, Protocol Version
  2-3:   Service Type ID (e.g. TUNNELING_REQUEST = 0x0420)
  4-5:   Total Length
  6-7:   Channel ID / SeqCount …

With Secure enabled:
  After standard header → Security Header:

  Security Header (example):
    Byte0: Security Control (version, protection type)
    Byte1-4: Session ID / Sequence Counter
    Byte5…: Ciphertext (encrypted KNX payload)
    Last 8/16 bytes: MIC

IP Secure Nonce (example):
  [ SessionID (4B) | SeqCounter (4B) | Flags (1B) | Padding … ]

Typical AAD:
  Parts of KNXnet/IP header (not encrypted) + SecurityControl.

────────────────────────────────────────────────────────────────────────────────
C) CONCRETE EXAMPLE - DATA SECURE 1-BIT GA WRITE

Suppose we want to send: GroupValue_Write(OFF) to GA=1/1/1 from Src=1.1.10.

Clear telegram (without secure):
  CF1=0xBC, Src=0x110A, Dst=0x0811, CF2=0x01 (len=1+apdu)
  APDU=0x81 0x00  (GroupValue_Write, Data=0)

With Secure:
  SCF=0x31 (v1, auth+enc)
  SeqNum=0x000000000001
  Nonce = buildNonce(Src=0x110A, Seq=1, SCF=0x31)
  Ciphertext = AES-CCM(APDU, key=GAkey, nonce, aad=[CF1,Src,Dst,CF2,SCF])
  MIC=8 bytes

Final frame:
  [CF1][Src][Dst][CF2][SCF][Seq(6B)][Cipher(APDU)][MIC(8B)][FCS]

────────────────────────────────────────────────────────────────────────────────
D) ANTI-REPLAY VERIFICATION
• Receiver maintains lastSeq[src,GA]
• If newSeq ≤ lastSeq ⇨ DROP
• If CCM verify fail ⇨ DROP
• If ok ⇨ accept, update lastSeq

────────────────────────────────────────────────────────────────────────────────
E) TYPICAL LENGTHS
• Typical APDU: 2-14 bytes (depends on DPT)
• Secure Overhead: SCF(1)+Seq(6)+MIC(8)=15 bytes + ciphertext(len(APDU))
• Extended frame: max 263 bytes (KNX TP extended frame)

────────────────────────────────────────────────────────────────────────────────
F) MINIMAL PSEUDOCODE
  aad  = concat(CF1, Src, Dst, CF2mask, SCF)
  nonce= concat(Src, Seq, SCF)
  {CT,TAG} = AES_CCM_Encrypt(Key, nonce, Plaintext=APDU, AAD=aad, TagLen=8)
  Frame = CF1|Src|Dst|CF2|SCF|Seq|CT|TAG|FCS

────────────────────────────────────────────────────────────────────────────────
11) LOW-LEVEL SECTION - binary layouts and operational procedures (DETAILS)
(This section adds "low-level" views useful for implementing encoder/decoder.
Fields and masks must be verified with the standard: here we provide operational TEMPLATES.)

11.1 Common conventions
• Endianness: all multi-byte fields on KNX are serialized in network byte order (big-endian).
• Bit numbering: bit7 = MSB, bit0 = LSB within a byte.
• CCM Nonce length: 13 bytes.
• Sequence Number Data Secure: 6 bytes (monotonic, persistent).
• Tag (MIC): typically 8 or 16 bytes (agreed/implementation).

11.2 L_Data.* (simplified view for Data Secure)
The "extended" frame for Data Secure can be seen as:

  +-------------+-------------+-------------+-------------+-------------+
  | Control1    |  Source (2) |  Dest (2)   |  Control2   |  ...        |
  +-------------+-------------+-------------+-------------+-------------+
  |  SecurityControl  |  SeqNumber (6)  |  Ciphertext(APDU) |  MIC(tag) |
  +-------------------+-----------------+-------------------+-----------+
                                     (Link layer FCS at the end)

Where:
• Control1 and Control2 are the classic KNX control fields (not encrypted).
• SecurityControl (SCF) = 1 byte (version/flags). (Verify mapping in standard.)
• SequenceNumber = 6 bytes, big-endian, incremented at each TX.
• Ciphertext(APDU) = variable length (depends on original APDU).
• MIC(tag) = 8/12/16 bytes; 8 or 16 are the most common choices.

11.3 Security Control Field (SCF) - TEMPLATE
  SCF Byte:
    bit7..bit5 : SecurityVersion (e.g. 0b001 for v1)        [TO VERIFY]
    bit4       : C (Confidentiality active)                [1 = encrypt]
    bit3       : A (Authentication active)                 [1 = MAC]
    bit2..bit0 : Options/Reserved                          [per standard]

Practical example: SCF = 0x68 (bin 0110 1000) → v1 + C + A (exemplary template).
Use the exact values required by the device/stack you must interoperate with.

11.4 Mutable fields and AAD (anti-tampering)
• DO NOT include in AAD bits that couplers/routers modify in transit, e.g.:
  - Hop Count (in Control2): gets decremented.
  - Repetition bit (in Control1): can vary.
• Include in AAD the "end-to-end immutable" fields:
  - Source Individual Address (2B)
  - Destination (Group Address) (2B) + 1 "group" bit intrinsic to field (as serialized)
  - Stable parts of Control1/Control2 (with mutable bits zeroed)
  - SecurityControl (SCF)

AAD Template (byte-string):
  AAD = CF1_masked || SRC(2) || DST(2) || CF2_masked || SCF

Where CF1_masked/CF2_masked = Control1/Control2 with mutable bits zeroed.
Exact masks depend on standard layout (apply AND with mask to zero).

11.5 CCM Nonce (13B) - TEMPLATE
The Nonce must be unique per key. A practical template for Data Secure is:
  NONCE = SRC(2B) || SEQ(6B) || SCF(1B) || ZPAD(4B)

• ZPAD = 0x00 repeated to complete to 13 bytes.
• Some stacks adopt mapping variants; always align to standard/vendor.
• Fundamental rule: NEVER reuse (key, NONCE).

11.6 Plaintext for CCM
  PLAINTEXT = APDU (entire application portion that in "clear" frames would follow Control2).
  NB: KNX Header remains in clear for routing, but authenticated (in AAD).

11.7 Tag length
  Choose 8 or 16 bytes based on stack. Longer tag = more robust MAC but more overhead.

────────────────────────────────────────────────────────────────────────────────
12) Step-by-step procedure (DATA SECURE) - with exact buffers

// INPUT (example)
GA_KEY         = 16B AES key        : 00 11 22 33 44 55 66 77 88 99 AA BB CC DD EE FF
SRC_ADDR       = 2B                 : 11 22        // Individual Address (area.line.device in 2B serialized)
DST_GA         = 2B                 : 0F FE        // Group Address on 2B serialized
CONTROL1       = 1B (e.g.)          : CC
CONTROL2       = 1B (e.g.)          : 49          // contains length and/or hopcount etc.
SCF            = 1B                 : 68          // v1 + C + A (TEMPLATE)
SEQ6 (persist) = 6B                 : 00 00 00 00 00 2A
APDU_PLAIN     = nB                 : 01 02 03 04 // generic example
TAGLEN         = 8                  // example

// 1) Mask mutable fields (TEMPLATE)
CF1_MASK = 0b1101_1111   // zero the "Repetition" bit in example (VERIFY IN STANDARD)
CF2_MASK = 0b1111_1000   // zero hopcount (3 LSB bits) in example (VERIFY IN STANDARD)
CF1_MASKED = CONTROL1 & CF1_MASK
CF2_MASKED = CONTROL2 & CF2_MASK

// 2) AAD
AAD = concat( CF1_MASKED, SRC_ADDR(2), DST_GA(2), CF2_MASKED, SCF )

// 3) NONCE (13B)
NONCE = concat( SRC_ADDR(2), SEQ6(6), SCF(1), 0x00 0x00 0x00 0x00 )

// 4) CCM Encrypt
(CT, TAG) = AES_CCM_Encrypt(
  key      = GA_KEY,
  nonce    = NONCE,
  plaintext= APDU_PLAIN,
  aad      = AAD,
  tagLen   = TAGLEN
)

// 5) Data Secure frame serialization
FRAME = concat(
  CONTROL1, SRC_ADDR(2), DST_GA(2), CONTROL2,
  SCF,
  SEQ6(6),
  CT,
  TAG
  // + link layer FCS by PHY/LLC driver
)

// 6) Persistence
SEQ6 := SEQ6 + 1   // write to NVRAM; NEVER reuse past values

────────────────────────────────────────────────────────────────────────────────
13) Reception (DATA SECURE) - verification and decryption

Input: FRAME
Parse: CONTROL1, SRC_ADDR, DST_GA, CONTROL2, SCF, SEQ6, CT, TAG

// Freshness
if SEQ6 <= last_seen[SRC_ADDR, DST_GA]: DROP

// AAD / NONCE reconstruction as in TX
CF1_MASKED = CONTROL1 & CF1_MASK
CF2_MASKED = CONTROL2 & CF2_MASK
AAD   = concat(CF1_MASKED, SRC_ADDR, DST_GA, CF2_MASKED, SCF)
NONCE = concat(SRC_ADDR, SEQ6, SCF, 0x00 0x00 0x00 0x00)

// Decrypt + Verify
APDU_PLAIN = AES_CCM_Decrypt_Verify(
  key    = GA_KEY,
  nonce  = NONCE,
  aad    = AAD,
  ct     = CT,
  tag    = TAG
)
if verify_failed: DROP

// Delivery
deliver(KNX_Header = (CONTROL1,SRC_ADDR,DST_GA,CONTROL2), APDU = APDU_PLAIN)

// Update freshness
last_seen[SRC_ADDR, DST_GA] = SEQ6

────────────────────────────────────────────────────────────────────────────────
14) KNX IP Secure - low-level (TUNNELING) TEMPLATE

14.1 Packet logical view
  +------------------ KNXnet/IP Header ------------------+
  |   Service, HdrLen, TotalLen, ...                     |
  +---------------- Security Header (IP Secure) ---------+
  |   SCF_IP (1B) | SessionID(?)/ChannelID(?) | SEQ(?)   |
  +------------------------------------------------------+
  |   Ciphertext (e.g. cEMI payload) |  TAG (8/16B)      |
  +------------------------------------------------------+

• "SessionID/ChannelID/SEQ" are fields that implement freshness on tunneling side;
  the standard specifies sizes/orders. Some stacks use 32-bit SEQ, others 48-bit.
• AAD includes clear parts (KNXnet/IP header + security header) needed to
  route the packet without access to the key.

14.2 TX procedure (IP Secure, tunneling)
INPUT: sess_key(16B), sess_seq, SCF_IP(1B), KNXNETIP_HDR, CEMI_PLAINTEXT, TAGLEN

AAD   = concat( KNXNETIP_HDR(masked), SecurityHeader(masked incl. SCF_IP, sess_seq, …) )
NONCE = buildNonce_IP( session_or_channel_ident, sess_seq, SCF_IP ) // 13B
(CT, TAG) = AES_CCM_Encrypt(sess_key, NONCE, CEMI_PLAINTEXT, AAD, TAGLEN)

PKT = serialize( KNXNETIP_HDR, SecurityHeader, CT, TAG )
sess_seq := sess_seq + 1  // persist

14.3 RX procedure (IP Secure, tunneling)
Parse header → extract sess_id/seq → check freshness → reconstruct AAD/NONCE →
CCM decrypt+verify → deliver cEMI/APDU to KNX stack.

────────────────────────────────────────────────────────────────────────────────
15) GUIDED example (DATA SECURE) with fictitious values (without CCM execution)

Suppose:
  CONTROL1   = CC
  SRC_ADDR   = 11 22
  DST_GA     = 0F FE
  CONTROL2   = 49
  SCF        = 68
  SEQ6       = 00 00 00 00 00 2A
  APDU_PLAIN = 01 02 03 04
  GA_KEY     = 00 11 22 33 44 55 66 77 88 99 AA BB CC DD EE FF
  TAGLEN     = 08

Mask (template):
  CF1_MASKED = CC & DF = CC  (if repetition bit was already 0)
  CF2_MASKED = 49 & F8 = 48  (zero hopcount 0b001 → 0)

AAD   = CC 11 22 0F FE 48 68
NONCE = 11 22 00 00 00 00 00 2A 68 00 00 00 00    // 13B
(CT,TAG) = CCM_Encrypt(GA_KEY, NONCE, 01 02 03 04, AAD, 8)

FRAME = CC 11 22 0F FE 49  68  00 00 00 00 00 2A  CT…  TAG…
        |clear header|   |SCF| |---- SEQ6 ----|  | ciphertext | | 8B |

Note: CONTROL2 in TX frame remains "49" (not masked) even though AAD has "48";
the mask is ONLY for MAC calculation, not for modifying the frame.

────────────────────────────────────────────────────────────────────────────────
16) Typical errors (LOW-LEVEL)
• Masking wrong bits in AAD ⇨ MIC mismatch after first hop.
• Reusing SEQ6 (loss of persistence) ⇨ NONCE reused ⇨ vulnerability.
• Wrong endianness for SEQ6 ⇨ broken freshness (RX discards).
• Mismatched TagLen between peers ⇨ decryption fails.
• Forgetting to include SCF in AAD/Nonce (when expected) ⇨ MIC mismatch.
• Inserting unmasked HopCount in AAD ⇨ fails at first router.
• Not supporting "extended frames" in driver/USB/IP ⇨ truncated/discarded frames.

────────────────────────────────────────────────────────────────────────────────
17) Minimalist API (pseudo-signatures) for an implementer

// AES-CCM (use a reliable standard cryptographic library)
ccm_encrypt(key: bytes16, nonce: bytes13, aad: bytes, plaintext: bytes, tag_len: int) -> (ct: bytes, tag: bytes)
ccm_decrypt_verify(key: bytes16, nonce: bytes13, aad: bytes, ciphertext: bytes, tag: bytes) -> plaintext: bytes | raise VerifyError

// Data Secure Builder
build_aad(cf1: u8, src: u16, dst: u16, cf2: u8, scf: u8) -> bytes
build_nonce(src: u16, seq6: u48, scf: u8) -> bytes13
encode_frame_secure(cf1, src, dst, cf2, scf, seq6, ct, tag) -> bytes

// Freshness store (persistent)
freshness_accept_and_update(src: u16, dst: u16, seq6: u48) -> bool  // uses window and last-seen

────────────────────────────────────────────────────────────────────────────────
18) Interoperability checklist (LOW-LEVEL)
[ ] "Mutable" bits are ZEROED in AAD (not in frame)
[ ] NONCE is 13B, field order coherent TX/RX
[ ] SEQ6 incremented and persisted BEFORE sending
[ ] TagLen agreed (8 or 16)
[ ] Driver supports extended frames
[ ] In RX, freshness check and window implemented
[ ] In RX, reassemble a clear APDU identical to original

────────────────────────────────────────────────────────────────────────────────
19) Final note (bit-level accuracy)
The bit layouts of Control1/Control2, the exact encoding of Security Control Field
and precise masks for AAD/Nonce are defined in the standard. The TEMPLATES above
work as operational guide and aim to avoid systematic errors
(nonce reuse, hopcount in AAD, endianness). For production, align to documents:
• EN 50090-3-4 (Data Secure)
• EN ISO 22510 (KNXnet/IP Secure)
• Vendor manuals (ABB, Gira, Weinzierl, etc.) for practical examples.

