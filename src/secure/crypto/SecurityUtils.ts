import { createHash, pbkdf2Sync, createCipheriv } from 'crypto'
import { generateKeyPair, sharedKey } from '../../Curve25519'

export interface KNXSecureConfig {
	channelId: number
	sequenceNumber: number
	serialNumber: number
	messageTag: number
}

export interface SecureWrapperData {
	knxHeader: Buffer
	secureSessionId: Buffer
	encapsulatedFrame: Buffer
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

	private static readonly MAX_PAYLOAD_LENGTH = 65279 // Maximum payload length according to spec

	private static readonly MAX_COUNTER_BLOCKS = 255 // Maximum counter blocks allowed

	private static readonly BLOCK_SIZE = 16 // AES block size

	/**
	 * Generate ECDH keypair using Curve25519
	 * @returns Public and private key pair
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
	static calculateSharedSecret(
		privateKey: Buffer,
		peerPublicKey: Buffer,
	): Buffer {
		// 1. Calculate Curve25519 shared secret (in little-endian)
		const sharedSecretLE = sharedKey(privateKey, peerPublicKey)

		// 2. Hash the shared secret with SHA-256
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
	 * CCM encryption for SECURE_WRAPPER
	 */
	static encryptSecureWrapper(
		data: SecureWrapperData,
		key: Buffer,
		config: KNXSecureConfig,
	): { ciphertext: Buffer; mac: Buffer } {
		// Validate payload length
		if (data.encapsulatedFrame.length > this.MAX_PAYLOAD_LENGTH) {
			throw new Error('Payload too long')
		}

		// A = KNXnet/IP secure wrapper header | Secure Session Identifier
		const associatedData = Buffer.concat([
			data.knxHeader,
			data.secureSessionId,
		])

		// P = encapsulated KNXnet/IP frame
		const payload = data.encapsulatedFrame

		// Generate B0 block
		const b0 = this.generateB0Block({
			payloadLength: payload.length,
			associatedLength: associatedData.length,
			sequenceInfo: config.sequenceNumber,
			serialNumber: config.serialNumber,
			messageTag: config.messageTag,
		})

		// Generate auth data blocks
		const authData = this.formatAuthData(associatedData)

		// Calculate CBC-MAC
		const mac = this.calculateCBCMAC(key, b0, authData, payload)

		// Encrypt payload using CTR mode
		const ciphertext = this.encryptCTRMode(
			key,
			payload,
			config.sequenceNumber,
			config.serialNumber,
			config.messageTag,
		)

		// Encrypt MAC
		const encryptedMac = this.encryptMac(key, mac, config)

		return { ciphertext, mac: encryptedMac }
	}

	/**
	 * CCM decryption for SECURE_WRAPPER
	 */
	static decryptSecureWrapper(
		ciphertext: Buffer,
		receivedMac: Buffer,
		data: SecureWrapperData,
		key: Buffer,
		config: KNXSecureConfig,
	): Buffer {
		// A = KNXnet/IP secure wrapper header | Secure Session Identifier
		const associatedData = Buffer.concat([
			data.knxHeader,
			data.secureSessionId,
		])

		// Decrypt ciphertext using CTR mode
		const plaintext = this.encryptCTRMode(
			key,
			ciphertext,
			config.sequenceNumber,
			config.serialNumber,
			config.messageTag,
		)

		// Generate B0 block
		const b0 = this.generateB0Block({
			payloadLength: plaintext.length,
			associatedLength: associatedData.length,
			sequenceInfo: config.sequenceNumber,
			serialNumber: config.serialNumber,
			messageTag: config.messageTag,
		})

		// Generate auth data blocks
		const authData = this.formatAuthData(associatedData)

		// Calculate MAC
		const calculatedMac = this.calculateCBCMAC(key, b0, authData, plaintext)

		// Encrypt calculated MAC
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
	 * CCM for TIMER_NOTIFY
	 */
	static calculateTimerNotifyMAC(
		header: Buffer,
		key: Buffer,
		config: KNXSecureConfig,
	): Buffer {
		// A = KNXnet/IP secure wrapper header only
		const associatedData = header

		// P is empty for TIMER_NOTIFY
		const payload = Buffer.alloc(0)

		// Generate B0 block
		const b0 = this.generateB0Block({
			payloadLength: 0,
			associatedLength: associatedData.length,
			sequenceInfo: config.sequenceNumber,
			serialNumber: config.serialNumber,
			messageTag: config.messageTag,
		})

		// Generate auth data blocks
		const authData = this.formatAuthData(associatedData)

		// Calculate CBC-MAC
		const mac = this.calculateCBCMAC(key, b0, authData, payload)

		// Encrypt MAC
		return this.encryptMac(key, mac, config)
	}

	/**
	 * Generate B0 block according to spec
	 */
	private static generateB0Block(params: {
		payloadLength: number
		associatedLength: number
		sequenceInfo: number
		serialNumber: number
		messageTag: number
	}): Buffer {
		const b0 = Buffer.alloc(16)

		// Flags
		b0[0] = 0x79

		// Nonce: sequenceInfo(6) | serialNumber(6) | messageTag(2)
		b0.writeUIntBE(params.sequenceInfo, 1, 6)
		b0.writeUIntBE(params.serialNumber, 7, 6)
		b0.writeUInt16BE(params.messageTag, 13)

		// Q: payload length
		b0.writeUInt16BE(params.payloadLength, 14)

		return b0
	}

	/**
	 * Generate Counter blocks according to spec
	 */
	private static generateCounterBlock(
		counter: number,
		sequenceInfo: number,
		serialNumber: number,
		messageTag: number,
	): Buffer {
		const ctr = Buffer.alloc(16)

		// Flags: 0x01
		ctr[0] = 0x01

		// Nonce: sequenceInfo(6) | serialNumber(6) | messageTag(2)
		ctr.writeUIntBE(sequenceInfo, 1, 6)
		ctr.writeUIntBE(serialNumber, 7, 6)
		ctr.writeUInt16BE(messageTag, 13)

		// Counter
		ctr[15] = counter & 0xff

		return ctr
	}

	/**
	 * Format associated data blocks
	 */
	private static formatAuthData(data: Buffer): Buffer[] {
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
	 * Calculate CBC-MAC
	 */
	private static calculateCBCMAC(
		key: Buffer,
		b0: Buffer,
		authData: Buffer[],
		payload: Buffer,
	): Buffer {
		const cipher = createCipheriv('aes-128-cbc', key, Buffer.alloc(16))

		// Process B0
		cipher.update(b0)

		// Process auth data blocks
		for (const block of authData) {
			cipher.update(block)
		}

		// Process payload
		if (payload.length > 0) {
			const payloadBlocks = this.formatAuthData(payload)
			for (const block of payloadBlocks) {
				cipher.update(block)
			}
		}

		return cipher.final().subarray(0, this.MAC_LENGTH)
	}

	/**
	 * Encrypt using CTR mode
	 */
	private static encryptCTRMode(
		key: Buffer,
		data: Buffer,
		sequenceInfo: number,
		serialNumber: number,
		messageTag: number,
	): Buffer {
		const numBlocks = Math.ceil(data.length / this.BLOCK_SIZE)
		if (numBlocks > this.MAX_COUNTER_BLOCKS) {
			throw new Error('Data too long for CTR mode encryption')
		}

		const result = Buffer.alloc(data.length)

		for (let i = 0; i < numBlocks; i++) {
			const counter = this.generateCounterBlock(
				i,
				sequenceInfo,
				serialNumber,
				messageTag,
			)

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
	 * Encrypt MAC according to spec
	 */
	private static encryptMac(
		key: Buffer,
		mac: Buffer,
		config: KNXSecureConfig,
	): Buffer {
		const counter = this.generateCounterBlock(
			0,
			config.sequenceNumber,
			config.serialNumber,
			config.messageTag,
		)

		const cipher = createCipheriv('aes-128-ecb', key, null)
		const keystream = cipher.update(counter)
		cipher.final()

		const encryptedMac = Buffer.alloc(this.MAC_LENGTH)
		for (let i = 0; i < this.MAC_LENGTH; i++) {
			encryptedMac[i] = mac[i] ^ keystream[i]
		}

		return encryptedMac
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
	 * Validate tunneling sequence number
	 */
	static validateTunnelingSequence(
		receivedSeq: number,
		lastSeq: number,
	): boolean {
		return receivedSeq > lastSeq
	}
}
