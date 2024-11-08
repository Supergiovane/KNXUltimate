import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
	SessionRequest,
	SessionResponse,
	SessionAuthenticate,
	SessionStatus,
} from '../../src/secure/messages/SessionMessages'
import HPAI from '../../src/protocol/HPAI'
import { KNX_CONSTANTS } from '../../src/protocol/KNXConstants'
import { KNX_SECURE } from '../../src/secure/SecureConstants'
import { SecurityUtils } from '../../src/secure/crypto/SecurityUtils'

describe('SessionMessages', () => {
	describe('SESSION_REQUEST', () => {
		const validControlEndpoint = new HPAI(
			'192.168.1.10',
			3671,
			KNX_CONSTANTS.IPV4_TCP,
		)
		const validPublicKey = Buffer.alloc(32).fill(1) // 32 bytes X value

		it('should create valid SessionRequest', () => {
			const request = new SessionRequest(
				validControlEndpoint,
				validPublicKey,
			)
			assert.strictEqual(request.controlEndpoint, validControlEndpoint)
			assert.strictEqual(request.publicKey, validPublicKey)
		})

		it('should contain valid HPAI information', () => {
			const request = new SessionRequest(
				validControlEndpoint,
				validPublicKey,
			)
			assert.strictEqual(request.controlEndpoint.host, '192.168.1.10')
			assert.strictEqual(request.controlEndpoint.port, 3671)
			assert.strictEqual(
				request.controlEndpoint.protocol,
				KNX_CONSTANTS.IPV4_TCP,
			)
		})

		it('should reject invalid public key length', () => {
			assert.throws(
				() =>
					new SessionRequest(validControlEndpoint, Buffer.alloc(31)),
				new RegExp(KNX_SECURE.ERROR.INVALID_KEY_LENGTH),
			)
		})

		it('should serialize and deserialize correctly', () => {
			const request = new SessionRequest(
				validControlEndpoint,
				validPublicKey,
			)
			const buffer = request.toBuffer()
			const decoded = SessionRequest.createFromBuffer(buffer)

			assert.strictEqual(
				decoded.controlEndpoint.host,
				validControlEndpoint.host,
			)
			assert.strictEqual(
				decoded.controlEndpoint.port,
				validControlEndpoint.port,
			)
			assert.ok(decoded.publicKey.equals(validPublicKey))
		})

		it('should reject invalid buffer length', () => {
			assert.throws(
				() => SessionRequest.createFromBuffer(Buffer.alloc(39)),
				new RegExp(KNX_SECURE.ERROR.INVALID_BUFFER_LENGTH),
			)
		})

		it('should create correct KNX header', () => {
			const request = new SessionRequest(
				validControlEndpoint,
				validPublicKey,
			)
			const header = request.toHeader()

			assert.strictEqual(
				header.service_type,
				KNX_SECURE.SERVICE_TYPE.SESSION_REQUEST,
			)
			assert.strictEqual(
				header.length,
				KNX_CONSTANTS.HEADER_SIZE_10 + request.toBuffer().length,
			)
		})
	})

	describe('SESSION_RESPONSE', () => {
		const validSessionId = 1
		const validPublicKey = Buffer.alloc(32).fill(2) // 32 bytes Y value
		const validMac = Buffer.alloc(16).fill(3) // 16 bytes MAC

		const deviceAuthCode =
			SecurityUtils.deriveDeviceAuthenticationCode('test-secret')
		const clientKeyPair = SecurityUtils.generateKeyPair()
		const serverKeyPair = SecurityUtils.generateKeyPair()

		it('should verify MAC with correct keys and data', () => {
			const sessionId = 1234
			const serialNumber = 56789

			const response = SessionResponse.create(
				sessionId,
				serverKeyPair.publicKey,
				clientKeyPair.publicKey,
				deviceAuthCode,
				serialNumber,
			)

			assert.ok(
				response.verifyMAC(
					deviceAuthCode,
					clientKeyPair.publicKey,
					serialNumber,
				),
			)
		})

		it('should fail MAC verification with modified serial number', () => {
			const sessionId = 1234
			const serialNumber = 56789

			const response = SessionResponse.create(
				sessionId,
				serverKeyPair.publicKey,
				clientKeyPair.publicKey,
				deviceAuthCode,
				serialNumber,
			)

			assert.strictEqual(
				response.verifyMAC(
					deviceAuthCode,
					clientKeyPair.publicKey,
					serialNumber + 1,
				),
				false,
				'Should fail with modified serial number',
			)
		})

		it('should fail MAC verification with modified MAC', () => {
			const sessionId = 1234
			const serialNumber = 56789

			const response = SessionResponse.create(
				sessionId,
				serverKeyPair.publicKey,
				clientKeyPair.publicKey,
				deviceAuthCode,
				serialNumber,
			)

			const modifiedMac = Buffer.from(response.messageAuthenticationCode)
			modifiedMac[0] ^= 0xff

			const modifiedResponse = new SessionResponse(
				sessionId,
				response.publicKey,
				modifiedMac,
			)

			assert.strictEqual(
				modifiedResponse.verifyMAC(
					deviceAuthCode,
					clientKeyPair.publicKey,
					serialNumber,
				),
				false,
				'Should fail with modified MAC',
			)
		})

		it('should create valid SessionResponse', () => {
			const response = new SessionResponse(
				validSessionId,
				validPublicKey,
				validMac,
			)
			assert.strictEqual(response.sessionId, validSessionId)
			assert.ok(response.publicKey.equals(validPublicKey))
			assert.ok(response.messageAuthenticationCode.equals(validMac))
		})

		it('should reject session ID 0', () => {
			assert.throws(
				() => new SessionResponse(0, validPublicKey, validMac),
				/Session ID 0 is reserved for multicast/,
			)
		})

		it('should reject invalid public key length', () => {
			assert.throws(
				() =>
					new SessionResponse(
						validSessionId,
						Buffer.alloc(31),
						validMac,
					),
				new RegExp(KNX_SECURE.ERROR.INVALID_KEY_LENGTH),
			)
		})

		it('should reject invalid MAC length', () => {
			assert.throws(
				() =>
					new SessionResponse(
						validSessionId,
						validPublicKey,
						Buffer.alloc(15),
					),
				new RegExp(KNX_SECURE.ERROR.INVALID_MAC_LENGTH),
			)
		})

		it('should serialize and deserialize correctly', () => {
			const response = new SessionResponse(
				validSessionId,
				validPublicKey,
				validMac,
			)
			const buffer = response.toBuffer()
			const decoded = SessionResponse.createFromBuffer(buffer)

			assert.strictEqual(decoded.sessionId, validSessionId)
			assert.ok(decoded.publicKey.equals(validPublicKey))
			assert.ok(decoded.messageAuthenticationCode.equals(validMac))
		})

		it('should create correct KNX header', () => {
			const response = new SessionResponse(
				validSessionId,
				validPublicKey,
				validMac,
			)
			const header = response.toHeader()

			assert.strictEqual(
				header.service_type,
				KNX_SECURE.SERVICE_TYPE.SESSION_RESPONSE,
			)
			assert.strictEqual(
				header.length,
				KNX_CONSTANTS.HEADER_SIZE_10 + response.toBuffer().length,
			)
		})
	})

	describe('SESSION_AUTHENTICATE', () => {
		const validUserId = 1 // Management user
		const validMac = Buffer.alloc(16).fill(4) // 16 bytes MAC
		const clientKeyPair = SecurityUtils.generateKeyPair()
		const serverKeyPair = SecurityUtils.generateKeyPair()
		const passwordHash = SecurityUtils.derivePasswordHash('test-password')

		describe('User ID Validation', () => {
			it('should handle all valid user ranges', () => {
				// Test user ID minimo
				assert.doesNotThrow(
					() =>
						new SessionAuthenticate(
							KNX_SECURE.USER.MANAGEMENT,
							Buffer.alloc(16).fill(1),
						),
				)

				// Test user ID massimo
				assert.doesNotThrow(
					() =>
						new SessionAuthenticate(
							KNX_SECURE.USER.USER_MAX,
							Buffer.alloc(16).fill(1),
						),
				)
			})

			it('should reject invalid user IDs', () => {
				assert.throws(
					() => new SessionAuthenticate(0, Buffer.alloc(16).fill(1)),
					new RegExp(KNX_SECURE.ERROR.INVALID_USER_ID),
				)

				assert.throws(
					() =>
						new SessionAuthenticate(0x80, Buffer.alloc(16).fill(1)),
					new RegExp(KNX_SECURE.ERROR.INVALID_USER_ID),
				)
			})
		})

		describe('MAC Verification', () => {
			it('should verify MAC with valid credentials', () => {
				const userId = KNX_SECURE.USER.MANAGEMENT
				const serialNumber = 56789

				const auth = SessionAuthenticate.create(
					userId,
					clientKeyPair.publicKey,
					serverKeyPair.publicKey,
					passwordHash,
					serialNumber,
				)

				assert.ok(
					auth.verifyMAC(
						passwordHash,
						clientKeyPair.publicKey,
						serverKeyPair.publicKey,
						serialNumber,
					),
				)
			})

			it('should fail with wrong password hash', () => {
				const userId = KNX_SECURE.USER.MANAGEMENT
				const serialNumber = 56789
				const wrongPasswordHash =
					SecurityUtils.derivePasswordHash('wrong-password')

				const auth = SessionAuthenticate.create(
					userId,
					clientKeyPair.publicKey,
					serverKeyPair.publicKey,
					passwordHash,
					serialNumber,
				)

				assert.strictEqual(
					auth.verifyMAC(
						wrongPasswordHash,
						clientKeyPair.publicKey,
						serverKeyPair.publicKey,
						serialNumber,
					),
					false,
					'Should fail with wrong password',
				)
			})
		})

		describe('Buffer Handling', () => {
			it('should handle minimum valid buffer size', () => {
				const auth = new SessionAuthenticate(
					KNX_SECURE.USER.MANAGEMENT,
					Buffer.alloc(16).fill(1),
				)
				const buffer = auth.toBuffer()
				const decoded = SessionAuthenticate.createFromBuffer(buffer)
				assert.deepStrictEqual(decoded, auth)
			})

			it('should reject invalid buffer sizes', () => {
				const tooSmall = Buffer.alloc(17) // Deve essere 18 bytes
				assert.throws(
					() => SessionAuthenticate.createFromBuffer(tooSmall),
					new RegExp(KNX_SECURE.ERROR.INVALID_BUFFER_LENGTH),
				)
			})

			it('should reject non-zero reserved byte', () => {
				const buffer = Buffer.alloc(18)
				buffer[0] = 1 // Il byte riservato deve essere 0
				assert.throws(
					() => SessionAuthenticate.createFromBuffer(buffer),
					new RegExp(KNX_SECURE.ERROR.RESERVED_BYTE),
				)
			})
		})

		it('should create valid SessionAuthenticate', () => {
			const auth = new SessionAuthenticate(validUserId, validMac)
			assert.strictEqual(auth.userId, validUserId)
			assert.ok(auth.messageAuthenticationCode.equals(validMac))
		})

		it('should reject invalid MAC length', () => {
			assert.throws(
				() => new SessionAuthenticate(validUserId, Buffer.alloc(15)),
				new RegExp(KNX_SECURE.ERROR.INVALID_MAC_LENGTH),
			)
		})

		it('should serialize and deserialize correctly', () => {
			const auth = new SessionAuthenticate(validUserId, validMac)
			const buffer = auth.toBuffer()
			const decoded = SessionAuthenticate.createFromBuffer(buffer)

			assert.strictEqual(decoded.userId, validUserId)
			assert.ok(decoded.messageAuthenticationCode.equals(validMac))
		})

		it('should create correct KNX header', () => {
			const auth = new SessionAuthenticate(validUserId, validMac)
			const header = auth.toHeader()

			assert.strictEqual(
				header.service_type,
				KNX_SECURE.SERVICE_TYPE.SESSION_AUTHENTICATE,
			)
			assert.strictEqual(
				header.length,
				KNX_CONSTANTS.HEADER_SIZE_10 + auth.toBuffer().length,
			)
		})
	})

	describe('SESSION_STATUS', () => {
		it('should create valid SessionStatus for all status codes', () => {
			Object.values(KNX_SECURE.SESSION_STATUS).forEach((status) => {
				if (typeof status === 'number') {
					const statusMsg = new SessionStatus(status)
					assert.strictEqual(statusMsg.status, status)
				}
			})
		})

		it('should serialize and deserialize correctly', () => {
			const original = new SessionStatus(
				KNX_SECURE.SESSION_STATUS.AUTHENTICATION_SUCCESS,
			)
			const buffer = original.toBuffer()
			const decoded = SessionStatus.createFromBuffer(buffer)

			assert.strictEqual(
				decoded.status,
				KNX_SECURE.SESSION_STATUS.AUTHENTICATION_SUCCESS,
			)
		})

		it('should reject invalid buffer length', () => {
			assert.throws(
				() => SessionStatus.createFromBuffer(Buffer.alloc(2)),
				/Invalid buffer length for SessionStatus/,
			)
		})

		it('should reject invalid buffer length', () => {
			assert.throws(
				() => SessionStatus.createFromBuffer(Buffer.alloc(2)),
				new RegExp(KNX_SECURE.ERROR.INVALID_BUFFER_LENGTH),
			)
		})

		it('should create correct KNX header', () => {
			const status = new SessionStatus(
				KNX_SECURE.SESSION_STATUS.AUTHENTICATION_SUCCESS,
			)
			const header = status.toHeader()

			assert.strictEqual(
				header.service_type,
				KNX_SECURE.SERVICE_TYPE.SESSION_STATUS,
			)
			assert.strictEqual(
				header.length,
				KNX_CONSTANTS.HEADER_SIZE_10 + status.toBuffer().length,
			)
		})
	})
})
