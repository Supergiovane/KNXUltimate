import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
	SecurityUtils,
	KNXSecureConfig,
	SecureWrapperData,
	MessageType,
} from '../../src/secure/crypto/SecurityUtils'

describe('SecurityUtils - KNX Secure Implementation Tests', async (t) => {
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

	describe('Key Generation and Authentication', async () => {
		it('should generate ECDH keypair with correct specifications', async () => {
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

		it('should calculate identical shared secrets between peers', async () => {
			const aliceKeyPair = SecurityUtils.generateKeyPair()
			const bobKeyPair = SecurityUtils.generateKeyPair()

			const aliceShared = SecurityUtils.calculateSessionKey(
				aliceKeyPair.privateKey,
				bobKeyPair.publicKey,
			)

			const bobShared = SecurityUtils.calculateSessionKey(
				bobKeyPair.privateKey,
				aliceKeyPair.publicKey,
			)

			assert(
				aliceShared.equals(bobShared),
				'ECDH shared secrets must match',
			)
			assert.equal(
				aliceShared.length,
				16,
				'Shared secret must be 16 bytes for AES-128',
			)
		})

		it('should derive device authentication code according to spec', async () => {
			const secret = 'TestDeviceSecret'
			const hash = SecurityUtils.deriveDeviceAuthenticationCode(secret)

			assert(hash instanceof Buffer)
			assert.equal(hash.length, 16, 'Device auth code must be 16 bytes')

			// Verify PBKDF2 parameters according to section 5.7.2.3.2
			// - HMAC-SHA256
			// - 65536 iterations
			// - salt: "device-authentication-code.1.secure.ip.knx.org"
			// Compare with known test vector if available
		})

		it('should derive password hash according to spec', async () => {
			const password = 'TestUserPassword'
			const hash = SecurityUtils.derivePasswordHash(password)

			assert(hash instanceof Buffer)
			assert.equal(hash.length, 16, 'Password hash must be 16 bytes')

			// Verify PBKDF2 parameters according to section 5.7.2.3.2
			// - HMAC-SHA256
			// - 65536 iterations
			// - salt: "user-password.1.secure.ip.knx.org"
			// Compare with known test vector if available
		})
	})

	describe('Secure Frame Processing', async () => {
		it('should handle session ID 0000h for multicast correctly', async () => {
			const multicastData: SecureWrapperData = {
				knxHeader: TEST_HEADER,
				secureSessionId: TEST_MULTICAST_SESSION_ID,
				encapsulatedFrame: TEST_FRAME,
				messageType: MessageType.SECURE_WRAPPER,
			}

			const encrypted = SecurityUtils.encrypt(
				multicastData,
				TEST_KEY,
				TEST_CONFIG,
			)

			assert(encrypted.ciphertext instanceof Buffer)
			assert(encrypted.mac instanceof Buffer)
			assert.equal(encrypted.mac.length, 16, 'MAC must be 16 bytes')

			const decrypted = SecurityUtils.decrypt(
				encrypted.ciphertext,
				encrypted.mac,
				multicastData,
				TEST_KEY,
				TEST_CONFIG,
			)

			assert(decrypted.equals(TEST_FRAME))
		})

		it('should correctly structure B0 block according to spec', async () => {
			const testData: SecureWrapperData = {
				knxHeader: TEST_HEADER,
				secureSessionId: TEST_SESSION_ID,
				encapsulatedFrame: TEST_FRAME,
				messageType: MessageType.SECURE_WRAPPER,
			}

			// Test internal B0 block generation
			// According to section 5.7.2.1.3:
			// - First byte must be 0x79
			// - Followed by sequence info (6 bytes)
			// - Serial number (6 bytes)
			// - Message tag (2 bytes)
			// - Payload length (2 bytes)
		})

		it('should enforce maximum payload length', async () => {
			const testData: SecureWrapperData = {
				knxHeader: TEST_HEADER,
				secureSessionId: TEST_SESSION_ID,
				encapsulatedFrame: Buffer.alloc(65280), // Max is 65279
				messageType: MessageType.SECURE_WRAPPER,
			}

			assert.throws(() => {
				SecurityUtils.encrypt(testData, TEST_KEY, TEST_CONFIG)
			}, Error('Payload too long'))
		})
	})

	describe('Timer Management', async () => {
		it('should handle 48-bit timer values', async () => {
			const maxTimer = 2 ** 48 - 1
			const currentTime = maxTimer - 1000
			const tolerance = 2000

			const result = SecurityUtils.validateMulticastTimer(
				currentTime,
				maxTimer,
				tolerance,
			)
			assert.equal(result, true, 'Should accept timer within tolerance')
		})

		it('should detect timer overflow attempts', async () => {
			const nearOverflow = 2 ** 48 - 100
			const afterOverflow = 50
			const tolerance = 2000

			const result = SecurityUtils.validateMulticastTimer(
				nearOverflow,
				afterOverflow,
				tolerance,
			)
			assert.equal(
				result,
				false,
				'Should reject potential overflow attack',
			)
		})

		it('should validate multicast timer tolerance', async () => {
			// Default tolerance is 2000ms according to spec
			const currentTime = 10000
			const receivedTime = 11500
			const tolerance = 2000

			const result = SecurityUtils.validateMulticastTimer(
				currentTime,
				receivedTime,
				tolerance,
			)
			assert.equal(result, true, 'Should accept timer within tolerance')

			const receivedTimeTooOld = 7500
			const resultOld = SecurityUtils.validateMulticastTimer(
				currentTime,
				receivedTimeTooOld,
				tolerance,
			)
			assert.equal(
				resultOld,
				false,
				'Should reject timer outside tolerance',
			)
		})
	})

	describe('Sequence Number Management', async () => {
		it('should validate tunneling sequence numbers', async () => {
			assert.equal(
				SecurityUtils.validateTunnelingSequence(5, 3),
				true,
				'Should accept higher sequence number',
			)
			assert.equal(
				SecurityUtils.validateTunnelingSequence(3, 5),
				false,
				'Should reject lower sequence number',
			)
			assert.equal(
				SecurityUtils.validateTunnelingSequence(5, 5),
				false,
				'Should reject equal sequence number',
			)
		})

		it('should handle sequence number transitions', async () => {
			// Test large sequence number transitions
			assert.equal(
				SecurityUtils.validateTunnelingSequence(1000000, 999999),
				true,
				'Should accept large sequence number increases',
			)
		})
	})

	describe('CCM Encryption', async () => {
		it('should implement CCM mode correctly', async () => {
			const testData: SecureWrapperData = {
				knxHeader: TEST_HEADER,
				secureSessionId: TEST_SESSION_ID,
				encapsulatedFrame: TEST_FRAME,
				messageType: MessageType.SECURE_WRAPPER,
			}

			const encrypted = SecurityUtils.encrypt(
				testData,
				TEST_KEY,
				TEST_CONFIG,
			)

			assert.equal(
				encrypted.mac.length,
				16,
				'MAC must be 16 bytes (128 bits)',
			)

			// Verify CTR mode encryption
			// Verify CBC-MAC calculation
		})

		it('should enforce block counter limits', async () => {
			const testData: SecureWrapperData = {
				knxHeader: TEST_HEADER,
				secureSessionId: TEST_SESSION_ID,
				encapsulatedFrame: Buffer.alloc(4081), // Exceeds max CTR blocks (255)
				messageType: MessageType.SECURE_WRAPPER,
			}

			assert.throws(() => {
				SecurityUtils.encrypt(testData, TEST_KEY, TEST_CONFIG)
			}, Error('Data too long for CTR mode encryption'))
		})

		it('should detect MAC tampering', async () => {
			const testData: SecureWrapperData = {
				knxHeader: TEST_HEADER,
				secureSessionId: TEST_SESSION_ID,
				encapsulatedFrame: TEST_FRAME,
				messageType: MessageType.SECURE_WRAPPER,
			}

			const encrypted = SecurityUtils.encrypt(
				testData,
				TEST_KEY,
				TEST_CONFIG,
			)

			// Modify MAC
			encrypted.mac[0] ^= 0xff

			assert.throws(() => {
				SecurityUtils.decrypt(
					encrypted.ciphertext,
					encrypted.mac,
					testData,
					TEST_KEY,
					TEST_CONFIG,
				)
			}, Error('MAC verification failed'))
		})
	})
})
