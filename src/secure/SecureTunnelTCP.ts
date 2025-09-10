#!/usr/bin/env node
/**
 * KNX IP Secure + Data Secure
 * - Loads credentials and GA keys from ETS keyring
 * - Establishes Secure Session (tunneling)
 */
import { SocketEvents } from 'src/KNXClient'
import * as net from 'net'
import * as crypto from 'crypto'
import { Keyring } from './keyring'
import {
	calculateMessageAuthenticationCodeCBC,
	encryptDataCtr,
	decryptCtr,
} from './security_primitives'
import {
	SCF_ENCRYPTION_S_A_DATA,
	KNXIP,
	CEMI,
	APCI,
	APCI_SEC,
	TPCI_DATA,
	SECURE_WRAPPER_TAG,
	SECURE_WRAPPER_CTR_SUFFIX,
	SECURE_WRAPPER_MAC_SUFFIX,
	SECURE_WRAPPER_OVERHEAD,
	KNXIP_HDR_SECURE_WRAPPER,
	KNXIP_HDR_TUNNELING_REQUEST,
	KNXIP_HDR_TUNNELING_ACK,
	KNXIP_HDR_TUNNELING_CONNECT_REQUEST,
	KNXIP_HDR_SECURE_SESSION_REQUEST,
	KNXIP_HDR_SECURE_SESSION_AUTHENTICATE,
	DATA_SECURE_CTR_SUFFIX,
	AUTH_CTR_IV,
	CONNECT_SEND_DELAY_MS,
	DEFAULT_STATUS_TIMEOUT_MS,
	SECURE_SESSION_TIMEOUT_MS,
	SECURE_AUTH_TIMEOUT_MS,
	SECURE_CONNECT_TIMEOUT_MS,
	HPAI_CONTROL_ENDPOINT_EMPTY,
	HPAI_DATA_ENDPOINT_EMPTY,
	CRD_TUNNEL_LINKLAYER,
	TUNNEL_CONN_HEADER_LEN,
	TUNNELING_ACK_TOTAL_LEN,
	WAIT_FOR_STATUS_DEFAULT_MS,
	KNXIP_HEADER_LEN,
	DEFAULT_SRC_IA_FALLBACK,
	PUBLIC_KEY_LEN,
	SECURE_SEQ_LEN,
	AES_BLOCK_LEN,
	MAC_LEN_FULL,
	MAC_LEN_SHORT,
	DEFAULT_KNXKEYS_PATH,
	DEFAULT_KNXKEYS_PASSWORD,
} from './secure_knx_constants'
import { EventEmitter, on } from 'stream'
import { KNXPacket } from 'src/protocol'

// Defaults for library consumers
const DEFAULT_GATEWAY_IP = '192.168.1.4'
const DEFAULT_GATEWAY_PORT = 3671
const DEFAULT_SERIAL = Buffer.from('000000000000', 'hex')
// DER SPKI prefix for X25519 (OID 1.3.101.110)
const X25519_SPKI_PREFIX_DER = Buffer.from('302a300506032b656e032100', 'hex')

type SecureHandshakeState = 'connecting' | 'session' | 'auth' | 'connect'

function nowBasedInitialSeq(): bigint {
	// Align with xknx: ms since 2018-01-05T00:00:00Z
	const base = Date.parse('2018-01-05T00:00:00Z')
	const diffMs = BigInt(Date.now() - base)
	return diffMs // already in ms, fits 48-bit for many years
}

export interface SecureConfig {
	// KNX/IP gateway IP (router or interface)
	gatewayIp: string
	// KNX/IP gateway port (default 3671)
	gatewayPort: number
	// Tunnel Interface Individual Address from the ETS keyring
	tunnelInterfaceIndividualAddress: string
	// Path to the .knxkeys file (absolute or relative)
	knxkeys_file_path?: string
	// ETS keyring password
	knxkeys_password?: string
	// Enable debug logging for the secure session
	debug?: boolean
}

export class SecureTunnelTCP extends EventEmitter {
	// Config
	private gatewayIp: string

	private gatewayPort: number

	private interfaceIa: string

	private debug: boolean

	private knxkeysPath: string

	private knxkeysPassword: string

	private socket?: net.Socket

	private sessionKey?: Buffer

	private sessionId: number = 0

	private secureSeq: number = 0 // wrapper sequence (6B)

	private channelId: number = 0

	private tunnelSeq: number = 0

	private privateKey?: crypto.KeyObject

	private publicKey?: Buffer

	private userId: number = 2

	private userPasswordKey?: Buffer

	private groupKeys: Map<number, Buffer> = new Map()

	private sendSeq48: bigint = 0n // Data Secure sender 6-byte sequence

	private serial: Buffer = DEFAULT_SERIAL // 6-byte serial for SecureWrapper

	private assignedIa: number = 0 // KNX IA assigned by gateway for this tunnel

	// keepalive disabled to allow process to exit after example
	private dbg(...args: any[]) {
		if (this.debug) console.log(...args)
	}

	constructor(cfg: SecureConfig) {
		super()
		this.gatewayIp = cfg.gatewayIp ?? DEFAULT_GATEWAY_IP
		this.gatewayPort = cfg.gatewayPort ?? DEFAULT_GATEWAY_PORT
		this.interfaceIa = cfg.tunnelInterfaceIndividualAddress ?? '1.1.255'
		this.debug = !!cfg.debug
		this.knxkeysPath = cfg.knxkeys_file_path || DEFAULT_KNXKEYS_PATH
		this.knxkeysPassword = cfg.knxkeys_password || DEFAULT_KNXKEYS_PASSWORD
	}

	async connect(): Promise<void> {
		console.log('🚀 KNX Secure with Data Secure')
		console.log('================================')

		await this.loadKeyring()
		await this.establishConnection()
		console.log('\n✅ Connected and authenticated!\n')
	}

	private async loadKeyring() {
		this.dbg('📂 Loading keyring and extracting credentials...')
		const kr = new Keyring()
		const keyringPath = this.knxkeysPath
		await kr.load(keyringPath, this.knxkeysPassword)

		// Interface from config
		const iface = kr.getInterface(this.interfaceIa)
		if (iface?.userId) this.userId = iface.userId // User ID from keyring if available
		// Password: keyring > default
		const password = iface?.decryptedPassword || 'passwordtunnel1'

		// Derive user password key
		this.userPasswordKey = crypto.pbkdf2Sync(
			Buffer.from(password, 'latin1'),
			Buffer.from('user-password.1.secure.ip.knx.org', 'latin1'),
			65536,
			16,
			'sha256',
		)

		// Load group keys for 1/1/1 and 1/1/2 (and any others in keyring)
		for (const [gaStr, g] of kr.getGroupAddresses()) {
			if (!g.decryptedKey) continue
			const ga = this.parseGroupAddress(gaStr)
			this.groupKeys.set(ga, g.decryptedKey.slice(0, 16))
		}
		if (!this.groupKeys.size) {
			throw new Error('No Data Secure group keys found in keyring.')
		}

		// Init sender sequence from persisted store
		this.sendSeq48 = nowBasedInitialSeq()
		// Choose gateway device by host IA if present, otherwise the interface IA
		const gatewayIaStr =
			iface?.host?.toString() || iface?.individualAddress?.toString()
		const dev = gatewayIaStr ? kr.getDevice(gatewayIaStr) : undefined
		if (dev?.serialNumber) {
			try {
				const ser = Buffer.from(dev.serialNumber, 'hex')
				if (ser.length === 6) {
					this.serial = ser
					console.log(
						`  Using KNX Serial (gateway ${gatewayIaStr}): ${this.serial.toString('hex')}`,
					)
				} else {
					console.log(
						`  Serial for gateway ${gatewayIaStr} not 6 bytes, keeping default.`,
					)
				}
			} catch {
				console.log(
					`  Could not parse serial for gateway ${gatewayIaStr}, keeping default.`,
				)
			}
		} else {
			console.log(
				`  Gateway device ${gatewayIaStr} not found in keyring or missing serial; using default serial.`,
			)
		}
		this.dbg(`  Interface IA: ${this.interfaceIa}`)
		this.dbg(`  User ID: ${this.userId}`)
		console.log(`  Loaded ${this.groupKeys.size} group keys`)
	}

	private establishConnection(): Promise<void> {
		return new Promise((resolve, reject) => {
			let handshakeTimer: NodeJS.Timeout | undefined
			let authTimer: NodeJS.Timeout | undefined
			let connectTimer: NodeJS.Timeout | undefined
			let resolved = false
			const clearAll = () => {
				if (handshakeTimer) {
					clearTimeout(handshakeTimer)
					handshakeTimer = undefined
				}
				if (authTimer) {
					clearTimeout(authTimer)
					authTimer = undefined
				}
				if (connectTimer) {
					clearTimeout(connectTimer)
					connectTimer = undefined
				}
			}
			const bail = (msg: string) => {
				clearAll()
				try {
					this.socket?.destroy()
				} catch {}
				reject(new Error(msg))
			}
			// Generate X25519 key pair vacca boiassa
			const keyPair = crypto.generateKeyPairSync('x25519')
			this.privateKey = keyPair.privateKey
			const exported = keyPair.publicKey.export({
				type: 'spki',
				format: 'der',
			}) as Buffer
			this.publicKey = exported.subarray(exported.length - 32)

			this.socket = new net.Socket()
			let state: SecureHandshakeState = 'connecting'

			this.socket.on('connect', () => {
				console.log('  ✓ TCP connected')
				state = 'session'
				// Send SESSION_REQUEST immediately
				this.socket!.write(this.buildSessionRequest())
				// Optional simple timeout -> reconnect
				handshakeTimer = setTimeout(
					() => bail('Timeout waiting for SESSION_RESPONSE'),
					SECURE_SESSION_TIMEOUT_MS,
				)
			})

			this.socket.on('data', (data) => {
				const type = data.readUInt16BE(2)

				if (
					type === KNXIP.SECURE_SESSION_RESPONSE &&
					state === 'session'
				) {
					if (handshakeTimer) {
						clearTimeout(handshakeTimer)
						handshakeTimer = undefined
					}
					// SESSION_RESPONSE
					this.sessionId = data.readUInt16BE(6)
					const serverPublicKey = data.subarray(8, 40)

					// Calculate session key
					const serverKey = crypto.createPublicKey({
						key: Buffer.concat([
							X25519_SPKI_PREFIX_DER,
							serverPublicKey,
						]),
						format: 'der',
						type: 'spki',
					})

					const secret = crypto.diffieHellman({
						privateKey: this.privateKey!,
						publicKey: serverKey,
					})

					const sessHash = crypto
						.createHash('sha256')
						.update(secret)
						.digest()
					this.sessionKey = sessHash.subarray(0, 16)

					// Send SESSION_AUTHENTICATE (wrapped)
					const authFrame =
						this.buildSessionAuthenticate(serverPublicKey)
					this.socket!.write(this.wrap(authFrame))
					state = 'auth'
					authTimer = setTimeout(
						() => bail('Timeout waiting for SESSION_STATUS'),
						SECURE_AUTH_TIMEOUT_MS,
					)
				} else if (type === KNXIP.SECURE_WRAPPER) {
					const inner = this.decrypt(data)
					const innerType = inner.readUInt16BE(2)

					if (
						innerType === KNXIP.SECURE_SESSION_STATUS &&
						state === 'auth'
					) {
						// SESSION_STATUS
						if (authTimer) {
							clearTimeout(authTimer)
							authTimer = undefined
						}
						if (inner[6] === 0) {
							// Send CONNECT_REQUEST (small delay for gateway reliability)
							const conn = this.buildConnectRequest()
							setTimeout(() => {
								this.socket!.write(this.wrap(conn))
								state = 'connect'
								connectTimer = setTimeout(
									() =>
										bail(
											'Timeout waiting for CONNECT_RESPONSE',
										),
									SECURE_CONNECT_TIMEOUT_MS,
								)
							}, CONNECT_SEND_DELAY_MS)
						}
					} else if (
						innerType === KNXIP.TUNNELING_CONNECT_RESPONSE &&
						state === 'connect'
					) {
						// CONNECT_RESPONSE
						this.channelId = inner[6]
						const status = inner[7]
						// Parse assigned IA from CRD after HPAI
						const hpaiLen = inner[8]
						const crdPos = 8 + hpaiLen
						if (inner.length >= crdPos + 4) {
							this.assignedIa =
								(inner[crdPos + 2] << 8) | inner[crdPos + 3]
							const iaStr = `${(this.assignedIa >> 12) & 0x0f}.${(this.assignedIa >> 8) & 0x0f}.${this.assignedIa & 0xff}`
							console.log(`  Assigned IA: ${iaStr}`)
						}
						if (status === 0) {
							console.log(
								`  ✓ Channel established: ${this.channelId}`,
							)
							clearAll()
							resolved = true
							resolve()
						}
					} else if (innerType === KNXIP.TUNNELING_ACK) {
						// TUNNELING_ACK; inner is full KNX/IP frame: header (6) + body (4)
						const ch = inner[6]
						const seq = inner[7]
						const status = inner[8]
						this.dbg(
							`  ← ACK: Channel ${ch}, Seq ${seq}, Status ${status}`,
						)
					} else if (innerType === KNXIP.TUNNELING_REQUEST) {
						// TUNNELING_REQUEST (incoming bus frame)
						// KNX/IP header (6) + 4-byte connection hdr, then cEMI
						const connHdr = inner.subarray(6, 10)
						const ch = connHdr[1]
						const seq = connHdr[2]
						// ACK this request
						const ackPlain = Buffer.concat([
							KNXIP_HDR_TUNNELING_ACK,
							Buffer.from([
								(TUNNELING_ACK_TOTAL_LEN >> 8) & 0xff,
								TUNNELING_ACK_TOTAL_LEN & 0xff,
							]),
							Buffer.from([
								TUNNEL_CONN_HEADER_LEN,
								ch,
								seq,
								0x00,
							]),
						])
						this.socket!.write(this.wrap(ackPlain))
						const cemi = inner.subarray(10)
						this.handleIncomingCemi(cemi)
					} else {
						this.dbg(
							`  ← Inner 0x${innerType.toString(16)} len=${inner.length}`,
						)
					}
				} else if (
					type === KNXIP.TUNNELING_CONNECT_RESPONSE &&
					state === 'connect'
				) {
					// CONNECT_RESPONSE (plain fallback)
					this.channelId = data[6]
					const status = data[7]
					if (status === 0) {
						console.log(
							`  ✓ Channel established: ${this.channelId}`,
						)
						clearAll()
						resolved = true
						resolve()
					}
				}
			})
			this.socket.on('error', (err) => {
				if (!resolved) bail(`Socket error: ${err.message}`)
				this.emit(SocketEvents.error, err)
			})
			this.socket.on('close', () => {
				if (!resolved) {
					bail('Socket closed before session established')
					return
				}
				console.log('Socket closed')
				this.emit(SocketEvents.close)
			})
			this.socket.connect(this.gatewayPort, this.gatewayIp)
		})
	}

	private wrap(frame: Buffer): Buffer {
		const seq = Buffer.alloc(SECURE_SEQ_LEN)
		seq.writeUIntBE(this.secureSeq++, 0, SECURE_SEQ_LEN)

		const len = SECURE_WRAPPER_OVERHEAD + frame.length
		const hdr = Buffer.concat([
			KNXIP_HDR_SECURE_WRAPPER,
			Buffer.from([len >> 8, len & 0xff]),
		])

		const additionalData = Buffer.concat([
			hdr,
			Buffer.from([this.sessionId >> 8, this.sessionId & 0xff]),
		])

		const block0 = Buffer.concat([
			seq,
			this.serial,
			SECURE_WRAPPER_TAG,
			Buffer.from([frame.length >> 8, frame.length & 0xff]),
		])

		const blocks = Buffer.concat([
			block0,
			Buffer.from([0x00, additionalData.length]),
			additionalData,
			frame,
		])
		const padded = Buffer.concat([
			blocks,
			Buffer.alloc((16 - (blocks.length % 16)) % 16, 0),
		])

		const cipher = crypto.createCipheriv(
			'aes-128-cbc',
			this.sessionKey!,
			Buffer.alloc(AES_BLOCK_LEN, 0),
		)
		cipher.setAutoPadding(false)
		const encrypted = Buffer.concat([cipher.update(padded), cipher.final()])
		const macCbc = encrypted.subarray(encrypted.length - MAC_LEN_FULL)

		const ctr0 = Buffer.concat([
			seq,
			this.serial,
			SECURE_WRAPPER_CTR_SUFFIX,
		])
		const ctr = crypto.createCipheriv('aes-128-ctr', this.sessionKey!, ctr0)
		const encMac = ctr.update(macCbc)
		const encData = ctr.update(frame)

		return Buffer.concat([
			hdr,
			Buffer.from([this.sessionId >> 8, this.sessionId & 0xff]),
			seq,
			this.serial,
			SECURE_WRAPPER_TAG,
			encData,
			encMac,
		])
	}

	private buildSessionRequest(): Buffer {
		// 06 10 | 09 51 | len | HPAI | <client public key 32B>
		const bodyLen = HPAI_CONTROL_ENDPOINT_EMPTY.length + PUBLIC_KEY_LEN
		const len = bodyLen + KNXIP_HEADER_LEN
		return Buffer.concat([
			KNXIP_HDR_SECURE_SESSION_REQUEST,
			Buffer.from([(len >> 8) & 0xff, len & 0xff]),
			HPAI_CONTROL_ENDPOINT_EMPTY,
			this.publicKey!,
		])
	}

	private buildSessionAuthenticate(serverPublicKey: Buffer): Buffer {
		// xor of both public keys
		const xor = Buffer.alloc(PUBLIC_KEY_LEN)
		for (let i = 0; i < PUBLIC_KEY_LEN; i++)
			xor[i] = this.publicKey![i] ^ serverPublicKey[i]

		// additionalData = header(0953) + 0x00 <userId> + xor
		const additionalData = Buffer.concat([
			// 06 10 | 09 53 | <len including header>
			KNXIP_HDR_SECURE_SESSION_AUTHENTICATE,
			Buffer.from([0x00, 0x18]),
			Buffer.from([0x00, this.userId]),
			xor,
		])

		// MAC-CBC over [block0(16 zeroes)] + [len(ad) + ad], padded
		const block0 = Buffer.alloc(AES_BLOCK_LEN, 0)
		const blocks = Buffer.concat([
			block0,
			Buffer.from([0x00, additionalData.length]),
			additionalData,
		])
		const padded = Buffer.concat([
			blocks,
			Buffer.alloc(
				(AES_BLOCK_LEN - (blocks.length % AES_BLOCK_LEN)) %
					AES_BLOCK_LEN,
				0,
			),
		])
		const cipher = crypto.createCipheriv(
			'aes-128-cbc',
			this.userPasswordKey!,
			Buffer.alloc(AES_BLOCK_LEN, 0),
		)
		cipher.setAutoPadding(false)
		const encrypted = Buffer.concat([cipher.update(padded), cipher.final()])
		const macCbc = encrypted.subarray(encrypted.length - AES_BLOCK_LEN)

		// Transform MAC using CTR with counter 0..0ff00 as per spec
		const ctr = crypto.createCipheriv(
			'aes-128-ctr',
			this.userPasswordKey!,
			AUTH_CTR_IV,
		)
		const mac = ctr.update(macCbc)

		// 0953 header + 00 + userId + transformed MAC
		const authBodyLen = 1 + 1 + AES_BLOCK_LEN
		const authLen = authBodyLen + KNXIP_HEADER_LEN
		return Buffer.concat([
			KNXIP_HDR_SECURE_SESSION_AUTHENTICATE,
			Buffer.from([(authLen >> 8) & 0xff, authLen & 0xff]),
			Buffer.from([0x00]),
			Buffer.from([this.userId]),
			mac,
		])
	}

	private buildConnectRequest(): Buffer {
		// 06 10 | 02 05 | len | HPAI ctrl | HPAI data | CRD (04 04 02 00)
		const bodyLen =
			HPAI_CONTROL_ENDPOINT_EMPTY.length +
			HPAI_DATA_ENDPOINT_EMPTY.length +
			CRD_TUNNEL_LINKLAYER.length
		const len = bodyLen + KNXIP_HEADER_LEN
		return Buffer.concat([
			KNXIP_HDR_TUNNELING_CONNECT_REQUEST,
			Buffer.from([(len >> 8) & 0xff, len & 0xff]),
			HPAI_CONTROL_ENDPOINT_EMPTY,
			HPAI_DATA_ENDPOINT_EMPTY,
			CRD_TUNNEL_LINKLAYER,
		])
	}

	private decrypt(frame: Buffer): Buffer {
		const seq = frame.subarray(8, 14)
		const serial = frame.subarray(14, 20)
		const tag = frame.subarray(20, 22)
		const data = frame.subarray(22, frame.length - 16)

		const ctr0 = Buffer.concat([
			seq,
			serial,
			tag,
			SECURE_WRAPPER_MAC_SUFFIX,
		])
		const dec = crypto.createDecipheriv(
			'aes-128-ctr',
			this.sessionKey!,
			ctr0,
		)
		dec.update(frame.subarray(frame.length - MAC_LEN_FULL))
		return dec.update(data)
	}

	private buildSecureApdu(
		groupAddr: number,
		plainApdu: Buffer,
		cemiFlags: number,
		srcIa: number,
	): Buffer {
		const key = this.groupKeys.get(groupAddr)
		if (!key)
			throw new Error(
				`No Data Secure key for GA ${this.formatGa(groupAddr)}`,
			)

		// Sequence number (6 bytes), persisted across all GA
		const seq = Buffer.alloc(SECURE_SEQ_LEN)
		const current = this.sendSeq48 & 0xffffffffffffn
		seq.writeUIntBE(Number(current), 0, 6)
		this.sendSeq48 = (this.sendSeq48 + 1n) & 0xffffffffffffn

		const addrFields = Buffer.from([
			(srcIa >> 8) & 0xff,
			srcIa & 0xff,
			(groupAddr >> 8) & 0xff,
			groupAddr & 0xff,
		])
		const frameFlagsMasked = cemiFlags & 0xffff // full flags; masked later in block
		const tpciInt = TPCI_DATA // Data TPDU

		// block_0 for CBC-MAC
		const block0 = Buffer.concat([
			seq,
			addrFields,
			Buffer.from([
				0x00,
				frameFlagsMasked & 0xff & CEMI.CTRL2_RELEVANT_MASK,
				(tpciInt << 2) + APCI_SEC.HIGH, // APCI_SEC high
				APCI_SEC.LOW, // APCI_SEC low
				0x00,
				plainApdu.length,
			]),
		])

		// MAC-CBC over SCF + payload
		const macCbcFull = calculateMessageAuthenticationCodeCBC(
			key,
			Buffer.from([SCF_ENCRYPTION_S_A_DATA]),
			plainApdu,
			block0,
		)
		const macCbc4 = macCbcFull.subarray(0, 4)

		// counter_0 for CTR encryption (seq + addr + 000000000100)
		const counter0 = Buffer.concat([
			seq,
			addrFields,
			DATA_SECURE_CTR_SUFFIX,
		])

		const [encPayload, encMac] = encryptDataCtr(
			key,
			counter0,
			macCbc4,
			plainApdu,
		)

		// Build SecureAPDU: APCI_SEC header, then SCF + [seq6][encPayload][encMac4]
		const apciSecHeader = APCI_SEC.HEADER
		const scf = Buffer.from([SCF_ENCRYPTION_S_A_DATA])
		return Buffer.concat([apciSecHeader, scf, seq, encPayload, encMac])
	}

	private decryptSecureApduAndExtractValue(
		rawCemi: Buffer,
	): { ga: number; srcIa: number; value?: number } | null {
		if (rawCemi.length < 10) return null
		// Parse CEMI header (code + additional info) di sta minchia
		const infoLen = rawCemi[1]
		const start = 2 + infoLen
		if (rawCemi.length < start + 8) return null
		const cemi = rawCemi.subarray(start)
		const flags = (cemi[0] << 8) | cemi[1]
		const srcIa = (cemi[2] << 8) | cemi[3]
		const dst = (cemi[4] << 8) | cemi[5]
		const npduLen = cemi[6]
		const tpdu = cemi.subarray(7)
		if (tpdu.length !== npduLen + 1) return null
		if (tpdu[0] !== 0x03 || tpdu[1] !== 0xf1) return null // not SecureAPDU
		const scf = tpdu[2]
		const seq = tpdu.subarray(3, 9)
		const encPayloadAndMac = tpdu.subarray(9)
		if (encPayloadAndMac.length < 4) return null
		const encMac = encPayloadAndMac.subarray(-4)
		const encPayload = encPayloadAndMac.subarray(0, -4)

		const key = this.groupKeys.get(dst)
		if (!key) return null

		const addrFields = Buffer.from([
			(srcIa >> 8) & 0xff,
			srcIa & 0xff,
			(dst >> 8) & 0xff,
			dst & 0xff,
		])
		const counter0 = Buffer.concat([
			seq,
			addrFields,
			DATA_SECURE_CTR_SUFFIX,
		])
		const [decPayload, macTr] = decryptCtr(
			key,
			counter0,
			encMac,
			encPayload,
		)

		const block0 = Buffer.concat([
			seq,
			addrFields,
			Buffer.from([
				0x00,
				flags & 0xff & CEMI.CTRL2_RELEVANT_MASK,
				(TPCI_DATA << 2) + APCI_SEC.HIGH,
				APCI_SEC.LOW,
				0x00,
				decPayload.length,
			]),
		])
		const macCbc = calculateMessageAuthenticationCodeCBC(
			key,
			Buffer.from([scf]),
			decPayload,
			block0,
		).subarray(0, MAC_LEN_SHORT)
		if (!macCbc.equals(macTr)) return null

		// Extract 1-bit value for GroupValue (0x0080 Write or 0x0040 Response)
		if (decPayload.length >= 2) {
			const apci = ((decPayload[0] & 0x03) << 8) | decPayload[1]
			const service = apci & APCI.SERVICE_MASK
			if (
				service === APCI.GROUP_VALUE_WRITE ||
				service === APCI.GROUP_VALUE_RESPONSE
			) {
				const bit = decPayload[1] & 0x01
				return { ga: dst, srcIa, value: bit }
			}
		}
		return { ga: dst, srcIa }
	}

	private handleIncomingCemi(cemi: Buffer) {
		const code = cemi[0]
		const infoLen = cemi[1]
		this.dbg(
			`  ← CEMI code=0x${code.toString(16)} infoLen=${infoLen} len=${cemi.length}`,
		)
		const res = this.decryptSecureApduAndExtractValue(cemi)
		if (!res) {
			this.dbg('  … Not a secure APDU or MAC fail')
			return
		}
		const { ga, value } = res
		if (
			ga === this.parseGroupAddress('1/1/2') &&
			typeof value !== 'undefined'
		) {
			console.log(`  ↩ Status 1/1/2 = ${value ? 'ON' : 'OFF'}`)
			this.waiters.get(ga)?.forEach((w) => w(value))
			this.waiters.delete(ga)
		}
	}

	private waiters: Map<number, Array<(v: number) => void>> = new Map()

	private waitForStatus(
		ga: number,
		timeoutMs = WAIT_FOR_STATUS_DEFAULT_MS,
	): Promise<number> {
		return new Promise((resolve, reject) => {
			const t = setTimeout(() => {
				this.waiters.delete(ga)
				reject(new Error('Timeout waiting for status'))
			}, timeoutMs)
			const cb = (v: number) => {
				clearTimeout(t)
				resolve(v)
			}
			const arr = this.waiters.get(ga) || []
			arr.push(cb)
			this.waiters.set(ga, arr)
		})
	}

	async sendCommand(gaStr: string, on: boolean): Promise<void> {
		console.log(`\n💡 Sending ${on ? 'ON' : 'OFF'} → ${gaStr}`)

		const ga = this.parseGroupAddress(gaStr)
		const srcIa =
			this.assignedIa ||
			this.parseIndividualAddress(DEFAULT_SRC_IA_FALLBACK)
		// Plain APDU for GroupValueWrite (1-bit)
		const apdu = Buffer.from([
			0x00,
			APCI.GROUP_VALUE_WRITE | (on ? 0x01 : 0x00),
		])

		// Build cEMI flags (use standard group frame values 0xBCE0)
		const flags = CEMI.DEFAULT_GROUP_FLAGS // group addr, std frame, no ack, low prio
		const secureApdu = this.buildSecureApdu(ga, apdu, flags, srcIa)
		await this.sendTunneling(
			this.buildLDataReq(secureApdu, srcIa, ga, flags),
		)
	}

	async readStatus(gaStr: string): Promise<number> {
		const ga = this.parseGroupAddress(gaStr)
		const srcIa =
			this.assignedIa ||
			this.parseIndividualAddress(DEFAULT_SRC_IA_FALLBACK)
		const flags = CEMI.DEFAULT_GROUP_FLAGS
		// Plain APDU for GroupValueRead
		const apdu = Buffer.from([0x00, APCI.GROUP_VALUE_READ])
		const secureApdu = this.buildSecureApdu(ga, apdu, flags, srcIa)
		const wait = this.waitForStatus(ga, DEFAULT_STATUS_TIMEOUT_MS)
		await this.sendTunneling(
			this.buildLDataReq(secureApdu, srcIa, ga, flags),
		)
		return wait
	}

	private buildLDataReq(
		secureApdu: Buffer,
		srcIa: number,
		ga: number,
		flags: number,
	): Buffer {
		return Buffer.concat([
			Buffer.from([CEMI.L_DATA_REQ, CEMI.ADDITIONAL_INFO_NONE]),
			Buffer.from([(flags >> 8) & 0xff, flags & 0xff]), // Control fields
			Buffer.from([(srcIa >> 8) & 0xff, srcIa & 0xff]), // Source
			Buffer.from([(ga >> 8) & 0xff, ga & 0xff]), // Destination (group)
			Buffer.from([secureApdu.length - 1]), // NPDU length
			secureApdu,
		])
	}

	private async sendTunneling(cemi: Buffer): Promise<void> {
		const seq = this.tunnelSeq++ & 0xff
		const connHeader = Buffer.from([
			TUNNEL_CONN_HEADER_LEN,
			this.channelId,
			seq,
			0x00,
		])
		const totalLength =
			KNXIP_HEADER_LEN + TUNNEL_CONN_HEADER_LEN + cemi.length
		const frame = Buffer.concat([
			KNXIP_HDR_TUNNELING_REQUEST,
			Buffer.from([(totalLength >> 8) & 0xff, totalLength & 0xff]),
			connHeader,
			cemi,
		])
		const wrapped = this.wrap(frame)
		this.socket!.write(wrapped)
	}

	private parseGroupAddress(ga: string): number {
		const [m, mi, s] = ga.split('/').map(Number)
		return ((m & 0x1f) << 11) | ((mi & 0x07) << 8) | (s & 0xff)
	}

	private formatGa(raw: number): string {
		const m = (raw >> 11) & 0x1f
		const mi = (raw >> 8) & 0x07
		const s = raw & 0xff
		return `${m}/${mi}/${s}`
	}

	private parseIndividualAddress(ia: string): number {
		const [a, l, d] = ia.split('.').map(Number)
		return ((a & 0x0f) << 12) | ((l & 0x0f) << 8) | (d & 0xff)
	}

	disconnect(): void {
		if (this.socket) {
			console.log('\n👋 Disconnecting')
			this.socket.destroy()
		}
	}
}

// Library file - no CLI runner.
