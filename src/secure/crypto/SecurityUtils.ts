import { createHash, pbkdf2Sync, createCipheriv } from 'crypto'
import { generateKeyPair, sharedKey } from '../../Curve25519'

export enum MessageType {
	SECURE_WRAPPER = 'SECURE_WRAPPER',
	SESSION_REQUEST = 'SESSION_REQUEST',
	SESSION_RESPONSE = 'SESSION_RESPONSE',
	SESSION_AUTHENTICATE = 'SESSION_AUTHENTICATE',
	TIMER_NOTIFY = 'TIMER_NOTIFY',
}

export interface KNXSecureConfig {
	channelId: number
	sequenceNumber: number
	serialNumber: number
	messageTag: number
	messageType: MessageType
}

export interface SecureWrapperData {
	messageType: MessageType
	knxHeader: Buffer
	secureSessionId: Buffer
	encapsulatedFrame?: Buffer
	dhPublicX?: Buffer // Client's public key
	dhPublicY?: Buffer // Server's public key
	userId?: number // For SESSION_AUTHENTICATE
}

export class SecurityUtils {
	// Constants according to KNX specification
	private static readonly DEVICE_AUTH_SALT =
		'device-authentication-code.1.secure.ip.knx.org'

	private static readonly USER_PASSWORD_SALT =
		'user-password.1.secure.ip.knx.org'

	private static readonly PBKDF2_ITERATIONS = 65536

	private static readonly AES_KEY_LENGTH = 16 // 128 bits

	private static readonly MAC_LENGTH = 16 // 128 bits

	private static readonly MAX_PAYLOAD_LENGTH = 65279 // 0xFEFF

	private static readonly MAX_COUNTER_BLOCKS = 255

	private static readonly BLOCK_SIZE = 16 // AES block size

	private static readonly CCM_FLAGS = 0x79 // For B0 block

	private static readonly CTR_FLAGS = 0x01 // For Counter blocks

	/**
	 * Generate ECDH keypair using Curve25519
	 */
	static generateKeyPair(): { publicKey: Buffer; privateKey: Buffer } {
		const seed = Buffer.alloc(32)
		const keyPair = generateKeyPair(seed)
		return {
			publicKey: Buffer.from(keyPair.public),
			privateKey: Buffer.from(keyPair.private),
		}
	}

	/**
	 * Calculate shared secret and session key using Curve25519
	 */
	static calculateSessionKey(
		privateKey: Buffer,
		peerPublicKey: Buffer,
	): Buffer {
		// 1. Calculate shared secret (in little-endian)
		const sharedSecretLE = sharedKey(privateKey, peerPublicKey)

		// 2. Hash shared secret with SHA-256 (converting to big-endian)
		const hash = createHash('sha256')
			.update(Buffer.from(sharedSecretLE))
			.digest()

		// 3. Take first 16 bytes for AES-128 key
		return hash.subarray(0, this.AES_KEY_LENGTH)
	}

	/**
	 * Derives the device authentication code
	 */
	static deriveDeviceAuthenticationCode(secret: string): Buffer {
		return pbkdf2Sync(
			secret,
			this.DEVICE_AUTH_SALT,
			this.PBKDF2_ITERATIONS,
			this.AES_KEY_LENGTH,
			'sha256',
		)
	}

	/**
	 * Derives the password hash
	 */
	static derivePasswordHash(password: string): Buffer {
		return pbkdf2Sync(
			password,
			this.USER_PASSWORD_SALT,
			this.PBKDF2_ITERATIONS,
			this.AES_KEY_LENGTH,
			'sha256',
		)
	}

	/**
	 * XOR operation between two buffers
	 */
	private static xor(a: Buffer, b: Buffer): Buffer {
		const result = Buffer.alloc(a.length)
		for (let i = 0; i < a.length; i++) {
			result[i] = a[i] ^ b[i]
		}
		return result
	}

	/**
	 * Calculate Associated Data (A) based on message type
	 */
	private static calculateAssociatedData(data: SecureWrapperData): Buffer {
		switch (data.messageType) {
			case MessageType.SECURE_WRAPPER:
				// A = KNXnet/IP header | Secure Session ID
				return Buffer.concat([data.knxHeader, data.secureSessionId])

			case MessageType.SESSION_RESPONSE:
				// A = KNXnet/IP Header | Session ID | (X ^ Y)
				return Buffer.concat([
					data.knxHeader,
					data.secureSessionId,
					this.xor(data.dhPublicX, data.dhPublicY),
				])

			case MessageType.SESSION_AUTHENTICATE: {
				// A = KNXnet/IP Header | 00h | User ID | (X ^ Y)
				const userIdBuf = Buffer.alloc(1)
				userIdBuf.writeUInt8(data.userId)
				return Buffer.concat([
					data.knxHeader,
					Buffer.from([0x00]),
					userIdBuf,
					this.xor(data.dhPublicX, data.dhPublicY),
				])
			}

			case MessageType.TIMER_NOTIFY:
				// A = KNXnet/IP Header only
				return data.knxHeader

			default:
				throw new Error(`Unsupported message type: ${data.messageType}`)
		}
	}

	/**
	 * Generate B0 block
	 */
	private static generateB0Block(
		config: KNXSecureConfig,
		payloadLength: number,
	): Buffer {
		const b0 = Buffer.alloc(this.BLOCK_SIZE)

		// Flags byte
		b0[0] = this.CCM_FLAGS

		// Nonce: sequenceInfo(6) | serialNumber(6) | messageTag(2)
		b0.writeUIntBE(config.sequenceNumber, 1, 6)
		b0.writeUIntBE(config.serialNumber, 7, 6)
		b0.writeUInt16BE(config.messageTag, 13)

		// Payload length Q
		b0.writeUInt16BE(payloadLength, 14)

		return b0
	}

	/**
	 * Generate Counter block
	 */
	private static generateCounterBlock(
		counter: number,
		config: KNXSecureConfig,
	): Buffer {
		const ctr = Buffer.alloc(this.BLOCK_SIZE)

		// Flags byte
		ctr[0] = this.CTR_FLAGS

		// Nonce: sequenceInfo(6) | serialNumber(6) | messageTag(2)
		ctr.writeUIntBE(config.sequenceNumber, 1, 6)
		ctr.writeUIntBE(config.serialNumber, 7, 6)
		ctr.writeUInt16BE(config.messageTag, 13)

		// Counter [i]
		ctr[15] = counter & 0xff

		return ctr
	}

	/**
	 * CCM encryption
	 */
	static encrypt(
		data: SecureWrapperData,
		key: Buffer,
		config: KNXSecureConfig,
	): { ciphertext: Buffer; mac: Buffer } {
		const payload = data.encapsulatedFrame || Buffer.alloc(0)

		// Validate payload length
		if (payload.length > this.MAX_PAYLOAD_LENGTH) {
			throw new Error('Payload too long')
		}

		// Calculate blocks required
		const numBlocks = Math.ceil(payload.length / this.BLOCK_SIZE)
		if (numBlocks > this.MAX_COUNTER_BLOCKS) {
			throw new Error('Data too long for CTR mode encryption')
		}

		// Calculate Associated Data (A) specific to message type
		const associatedData = this.calculateAssociatedData(data)

		// Generate B0 block
		const b0 = this.generateB0Block(config, payload.length)

		// Calculate CBC-MAC
		const mac = this.calculateCBCMAC(key, b0, associatedData, payload)

		// Encrypt payload using CTR mode (if present)
		const ciphertext =
			payload.length > 0
				? this.encryptCTRMode(key, payload, config)
				: Buffer.alloc(0)

		// Encrypt MAC
		const encryptedMac = this.encryptMac(key, mac, config)

		return { ciphertext, mac: encryptedMac }
	}

	/**
	 * CCM decryption
	 */
	static decrypt(
		ciphertext: Buffer,
		receivedMac: Buffer,
		data: SecureWrapperData,
		key: Buffer,
		config: KNXSecureConfig,
	): Buffer {
		// Decrypt ciphertext using CTR mode
		const plaintext = this.encryptCTRMode(key, ciphertext, config)

		// Calculate Associated Data (A) specific to message type
		const associatedData = this.calculateAssociatedData(data)

		// Generate B0 block
		const b0 = this.generateB0Block(config, plaintext.length)

		// Calculate CBC-MAC
		const calculatedMac = this.calculateCBCMAC(
			key,
			b0,
			associatedData,
			plaintext,
		)

		// Encrypt calculated MAC for comparison
		const encryptedCalculatedMac = this.encryptMac(
			key,
			calculatedMac,
			config,
		)

		// Verify MAC
		if (!encryptedCalculatedMac.equals(receivedMac)) {
			throw new Error('MAC verification failed')
		}

		return plaintext
	}

	/**
	 * Calculate CBC-MAC
	 */
	private static calculateCBCMAC(
		key: Buffer,
		b0: Buffer,
		associatedData: Buffer,
		payload: Buffer,
	): Buffer {
		const cipher = createCipheriv('aes-128-cbc', key, Buffer.alloc(16))

		// Process B0
		let mac = cipher.update(b0)

		// Process Associated Data with XOR
		const adBlocks = this.formatBlocks(associatedData)
		for (const block of adBlocks) {
			mac = this.xor(mac, block)
			mac = cipher.update(mac)
		}

		// Process Payload with XOR if present
		if (payload.length > 0) {
			const payloadBlocks = this.formatBlocks(payload)
			for (const block of payloadBlocks) {
				mac = this.xor(mac, block)
				mac = cipher.update(mac)
			}
		}

		cipher.final()
		return mac.subarray(0, this.MAC_LENGTH)
	}

	/**
	 * Format data into AES blocks
	 */
	private static formatBlocks(data: Buffer): Buffer[] {
		const blocks: Buffer[] = []
		const numBlocks = Math.ceil(data.length / this.BLOCK_SIZE)

		for (let i = 0; i < numBlocks; i++) {
			const block = Buffer.alloc(this.BLOCK_SIZE)
			const start = i * this.BLOCK_SIZE
			const end = Math.min(start + this.BLOCK_SIZE, data.length)
			data.copy(block, 0, start, end)
			blocks.push(block)
		}

		return blocks
	}

	/**
	 * Encrypt using CTR mode
	 */
	private static encryptCTRMode(
		key: Buffer,
		data: Buffer,
		config: KNXSecureConfig,
	): Buffer {
		const result = Buffer.alloc(data.length)
		const numBlocks = Math.ceil(data.length / this.BLOCK_SIZE)

		for (let i = 0; i < numBlocks; i++) {
			const counter = this.generateCounterBlock(i + 1, config)
			const cipher = createCipheriv('aes-128-ecb', key, null)
			const keystream = cipher.update(counter)
			cipher.final()

			const start = i * this.BLOCK_SIZE
			const end = Math.min(start + this.BLOCK_SIZE, data.length)

			for (let j = 0; j < end - start; j++) {
				result[start + j] = data[start + j] ^ keystream[j]
			}
		}

		return result
	}

	/**
	 * Encrypt MAC
	 */
	private static encryptMac(
		key: Buffer,
		mac: Buffer,
		config: KNXSecureConfig,
	): Buffer {
		// Use Counter[0] for MAC encryption
		const counter = this.generateCounterBlock(0, config)

		const cipher = createCipheriv('aes-128-ecb', key, null)
		const keystream = cipher.update(counter)
		cipher.final()

		return this.xor(mac, keystream.subarray(0, this.MAC_LENGTH))
	}

	/**
	 * Validate multicast timer
	 */
	static validateMulticastTimer(
		receivedTimer: number,
		localTimer: number,
		latencyTolerance: number,
	): boolean {
		const diff = receivedTimer - localTimer
		return diff >= -latencyTolerance && diff <= latencyTolerance
	}

	/**
	 * Validate tunneling sequence
	 */
	static validateTunnelingSequence(
		receivedSeq: number,
		lastSeq: number,
	): boolean {
		return receivedSeq > lastSeq
	}
}
