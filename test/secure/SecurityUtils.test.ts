import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
	SecurityUtils,
	KNXSecureConfig,
	SecureWrapperData,
	MessageType,
} from '../../src/secure/crypto/SecurityUtils'

describe('SecurityUtils - KNX Security Implementation Tests', async () => {
	// Test constants
	const TEST_HEADER = Buffer.from([0x06, 0x10, 0x05, 0x30])
	const TEST_SESSION_ID = Buffer.from([0x00, 0x01])
	const TEST_MULTICAST_SESSION_ID = Buffer.from([0x00, 0x00])
	const TEST_FRAME = Buffer.from([0x11, 0x22, 0x33, 0x44])
	const TEST_KEY = Buffer.alloc(16).fill(0x42)

	const TEST_CONFIG: KNXSecureConfig = {
		channelId: 1,
		sequenceNumber: 12345,
		serialNumber: 67890,
		messageTag: 1,
		messageType: MessageType.SECURE_WRAPPER,
	}

	describe('ECDH Key Generation and Derivation', async () => {
		it('should generate valid Curve25519 keypair', async () => {
			const keyPair = SecurityUtils.generateKeyPair()

			assert(keyPair.publicKey instanceof Buffer)
			assert(keyPair.privateKey instanceof Buffer)
			assert.equal(
				keyPair.publicKey.length,
				32,
				'Public key must be 32 bytes (Curve25519)',
			)
			assert.equal(
				keyPair.privateKey.length,
				32,
				'Private key must be 32 bytes (Curve25519)',
			)
		})

		it('should calculate identical session keys between peers', async () => {
			const aliceKeyPair = SecurityUtils.generateKeyPair()
			const bobKeyPair = SecurityUtils.generateKeyPair()

			const aliceSessionKey = SecurityUtils.calculateSessionKey(
				aliceKeyPair.privateKey,
				bobKeyPair.publicKey,
			)

			const bobSessionKey = SecurityUtils.calculateSessionKey(
				bobKeyPair.privateKey,
				aliceKeyPair.publicKey,
			)

			assert(
				aliceSessionKey.equals(bobSessionKey),
				'Session keys must match',
			)
			assert.equal(
				aliceSessionKey.length,
				16,
				'Session key must be 16 bytes for AES-128',
			)
		})

		it('should derive device authentication code with correct parameters', async () => {
			const deviceSecret = 'TestDeviceSecret'
			const hash =
				SecurityUtils.deriveDeviceAuthenticationCode(deviceSecret)

			assert(hash instanceof Buffer)
			assert.equal(hash.length, 16, 'Device auth code must be 16 bytes')
			// KNX spec: PBKDF2-HMAC-SHA256, 65536 iterations
		})

		it('should derive user password hash with correct parameters', async () => {
			const userPassword = 'TestUserPassword'
			const hash = SecurityUtils.derivePasswordHash(userPassword)

			assert(hash instanceof Buffer)
			assert.equal(hash.length, 16, 'Password hash must be 16 bytes')
			// KNX spec: PBKDF2-HMAC-SHA256, 65536 iterations
		})
	})

	describe('CCM Implementation', async () => {
		describe('Associated Data (A) Calculation', async () => {
			it('should handle SECURE_WRAPPER', async () => {
				const data: SecureWrapperData = {
					messageType: MessageType.SECURE_WRAPPER,
					knxHeader: TEST_HEADER,
					secureSessionId: TEST_SESSION_ID,
					encapsulatedFrame: TEST_FRAME,
				}

				const encrypted = SecurityUtils.encrypt(
					data,
					TEST_KEY,
					TEST_CONFIG,
				)
				assert(encrypted.mac instanceof Buffer)
				assert.equal(encrypted.mac.length, 16)
			})

			it('should handle SESSION_RESPONSE with DH keys', async () => {
				const publicKeyX = Buffer.alloc(32).fill(0x11)
				const publicKeyY = Buffer.alloc(32).fill(0x22)

				const data: SecureWrapperData = {
					messageType: MessageType.SESSION_RESPONSE,
					knxHeader: TEST_HEADER,
					secureSessionId: TEST_SESSION_ID,
					dhPublicX: publicKeyX,
					dhPublicY: publicKeyY,
				}

				const config = {
					...TEST_CONFIG,
					messageType: MessageType.SESSION_RESPONSE,
				}
				const encrypted = SecurityUtils.encrypt(data, TEST_KEY, config)
				assert.equal(encrypted.mac.length, 16)
			})

			it('should handle SESSION_AUTHENTICATE with user ID', async () => {
				const publicKeyX = Buffer.alloc(32).fill(0x11)
				const publicKeyY = Buffer.alloc(32).fill(0x22)

				const data: SecureWrapperData = {
					messageType: MessageType.SESSION_AUTHENTICATE,
					knxHeader: TEST_HEADER,
					secureSessionId: TEST_SESSION_ID,
					dhPublicX: publicKeyX,
					dhPublicY: publicKeyY,
					userId: 1,
				}

				const config = {
					...TEST_CONFIG,
					messageType: MessageType.SESSION_AUTHENTICATE,
				}
				const encrypted = SecurityUtils.encrypt(data, TEST_KEY, config)
				assert.equal(encrypted.mac.length, 16)
			})

			it('should handle TIMER_NOTIFY', async () => {
				const data: SecureWrapperData = {
					messageType: MessageType.TIMER_NOTIFY,
					knxHeader: TEST_HEADER,
					secureSessionId: TEST_SESSION_ID,
				}

				const config = {
					...TEST_CONFIG,
					messageType: MessageType.TIMER_NOTIFY,
				}
				const encrypted = SecurityUtils.encrypt(data, TEST_KEY, config)
				assert.equal(encrypted.mac.length, 16)
			})
		})

		describe('Block Generation and Processing', async () => {
			it('should generate B0 block with correct format', async () => {
				const data: SecureWrapperData = {
					messageType: MessageType.SECURE_WRAPPER,
					knxHeader: TEST_HEADER,
					secureSessionId: TEST_SESSION_ID,
					encapsulatedFrame: TEST_FRAME,
				}

				const config: KNXSecureConfig = {
					channelId: 1,
					sequenceNumber: 0x123456,
					serialNumber: 0x789abc,
					messageTag: 0xdef0,
					messageType: MessageType.SECURE_WRAPPER,
				}

				const encrypted = SecurityUtils.encrypt(data, TEST_KEY, config)
				assert(encrypted.ciphertext instanceof Buffer)
				assert.equal(encrypted.mac.length, 16)
			})

			it('should handle multiple counter blocks correctly', async () => {
				const data: SecureWrapperData = {
					messageType: MessageType.SECURE_WRAPPER,
					knxHeader: TEST_HEADER,
					secureSessionId: TEST_SESSION_ID,
					encapsulatedFrame: Buffer.alloc(48), // 3 blocks
				}

				const encrypted = SecurityUtils.encrypt(
					data,
					TEST_KEY,
					TEST_CONFIG,
				)
				assert.equal(encrypted.ciphertext.length, 48)
			})

			it('should detect MAC tampering', async () => {
				const data: SecureWrapperData = {
					messageType: MessageType.SECURE_WRAPPER,
					knxHeader: TEST_HEADER,
					secureSessionId: TEST_SESSION_ID,
					encapsulatedFrame: TEST_FRAME,
				}

				const encrypted = SecurityUtils.encrypt(
					data,
					TEST_KEY,
					TEST_CONFIG,
				)
				encrypted.mac[0] ^= 0xff // Modify MAC

				assert.throws(() => {
					SecurityUtils.decrypt(
						encrypted.ciphertext,
						encrypted.mac,
						data,
						TEST_KEY,
						TEST_CONFIG,
					)
				}, /MAC verification failed/)
			})
		})

		describe('Limits and Error Handling', async () => {
			it('should enforce maximum payload length', async () => {
				const data: SecureWrapperData = {
					messageType: MessageType.SECURE_WRAPPER,
					knxHeader: TEST_HEADER,
					secureSessionId: TEST_SESSION_ID,
					encapsulatedFrame: Buffer.alloc(65280), // Exceeds 65279
				}

				assert.throws(() => {
					SecurityUtils.encrypt(data, TEST_KEY, TEST_CONFIG)
				}, /Payload too long/)
			})

			it('should enforce maximum counter blocks', async () => {
				const data: SecureWrapperData = {
					messageType: MessageType.SECURE_WRAPPER,
					knxHeader: TEST_HEADER,
					secureSessionId: TEST_SESSION_ID,
					encapsulatedFrame: Buffer.alloc(4081), // Exceeds 255 blocks
				}

				assert.throws(() => {
					SecurityUtils.encrypt(data, TEST_KEY, TEST_CONFIG)
				}, /Data too long for CTR mode encryption/)
			})

			it('should reject unsupported message types', async () => {
				const data: SecureWrapperData = {
					messageType: 'INVALID' as MessageType,
					knxHeader: TEST_HEADER,
					secureSessionId: TEST_SESSION_ID,
				}

				assert.throws(() => {
					SecurityUtils.encrypt(data, TEST_KEY, TEST_CONFIG)
				}, /Unsupported message type/)
			})
		})
	})

	describe('Timer and Sequence Management', async () => {
		describe('Multicast Timer Validation', async () => {
			it('should validate timer within tolerance', async () => {
				const currentTime = 10000
				const receivedTime = 11500
				const tolerance = 2000

				const result = SecurityUtils.validateMulticastTimer(
					currentTime,
					receivedTime,
					tolerance,
				)
				assert.equal(result, true)
			})

			it('should reject timer outside tolerance', async () => {
				const currentTime = 10000
				const receivedTime = 7500
				const tolerance = 2000

				const result = SecurityUtils.validateMulticastTimer(
					currentTime,
					receivedTime,
					tolerance,
				)
				assert.equal(result, false)
			})

			it('should handle 48-bit timer values', async () => {
				const maxTimer = 2 ** 48 - 1
				const nearMax = maxTimer - 1000
				const tolerance = 2000

				const result = SecurityUtils.validateMulticastTimer(
					nearMax,
					maxTimer,
					tolerance,
				)
				assert.equal(result, true)
			})
		})

		describe('Tunneling Sequence Validation', async () => {
			it('should validate increasing sequence', async () => {
				assert.equal(
					SecurityUtils.validateTunnelingSequence(5, 3),
					true,
				)
				assert.equal(
					SecurityUtils.validateTunnelingSequence(1000000, 999999),
					true,
				)
			})

			it('should reject non-increasing sequence', async () => {
				assert.equal(
					SecurityUtils.validateTunnelingSequence(3, 5),
					false,
				)
				assert.equal(
					SecurityUtils.validateTunnelingSequence(5, 5),
					false,
				)
			})
		})
	})

	describe('Multicast Session Handling', async () => {
		it('should handle session ID 0000h correctly', async () => {
			const multicastData: SecureWrapperData = {
				messageType: MessageType.SECURE_WRAPPER,
				knxHeader: TEST_HEADER,
				secureSessionId: TEST_MULTICAST_SESSION_ID,
				encapsulatedFrame: TEST_FRAME,
			}

			const encrypted = SecurityUtils.encrypt(
				multicastData,
				TEST_KEY,
				TEST_CONFIG,
			)
			assert(encrypted.ciphertext instanceof Buffer)
			assert.equal(encrypted.mac.length, 16)

			const decrypted = SecurityUtils.decrypt(
				encrypted.ciphertext,
				encrypted.mac,
				multicastData,
				TEST_KEY,
				TEST_CONFIG,
			)

			assert(decrypted.equals(TEST_FRAME))
		})
	})
})
