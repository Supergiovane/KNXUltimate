import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import sinon from 'sinon'
import SecureSession, {
	SecureSessionState,
} from '../../src/secure/SecureSession'
import { SecurityUtils } from '../../src/secure/crypto/SecurityUtils'
import {
	SessionRequest,
	SessionResponse,
	SessionAuthenticate,
	SessionStatus,
} from '../../src/secure/messages/SessionMessages'
import SecureWrapper from '../../src/secure/messages/SecureWrapper'
import {
	KNX_SECURE,
	SecureSessionStatus,
} from '../../src/secure/SecureConstants'

describe('SecureSession', () => {
	const mockOptions = {
		deviceAuthCode: 'test-device-code',
		userId: 1,
		password: 'test-password',
		serialNumber: 123456,
	}

	const mockKeyPair = {
		publicKey: Buffer.alloc(32, 1), // 32 byte buffer filled with 1s
		privateKey: Buffer.alloc(32, 2), // 32 byte buffer filled with 2s
	}

	// All mocks according to KNX Secure specification
	const MOCK = {
		// ECDH public key X/Y must be 32 bytes (256-bit) for Curve25519
		SERVER_KEY: Buffer.alloc(32, 0x01),
		CLIENT_KEY: Buffer.alloc(32, 0x02),
		// CCM MAC must be 16 bytes (128-bit)
		MAC: Buffer.alloc(16, 0xff),
		// AES-128 session key must be 16 bytes
		SESSION_KEY: Buffer.alloc(16, 0xaa),
		// Device Authentication Code hash must be 16 bytes (AES-128)
		DEVICE_AUTH: Buffer.alloc(16, 0xbb),
		// Password hash must be 16 bytes (AES-128)
		PASSWORD_HASH: Buffer.alloc(16, 0xcc),
		SESSION_ID: 1,
		SERIAL_NUMBER: 123456,
		DATA: Buffer.from('test-data'),
	}

	const mockPasswordHash = Buffer.alloc(16, 0xcc)
	const mockDeviceAuthHash = Buffer.alloc(16, 0xbb)
	const mockSessionKey = Buffer.alloc(16, 0xaa)

	let session: SecureSession

	let clock: sinon.SinonFakeTimers

	beforeEach(() => {
		// Setup fake timer
		clock = sinon.useFakeTimers()

		// Setup mocks
		SecurityUtils.generateKeyPair = () => mockKeyPair
		SecurityUtils.calculateSessionKey = () => mockSessionKey
		SecurityUtils.deriveDeviceAuthenticationCode = () => mockDeviceAuthHash
		SecurityUtils.derivePasswordHash = () => mockPasswordHash

		session = new SecureSession(mockOptions)
	})

	afterEach(() => {
		// Restore timer
		clock.restore()
	})

	describe('Constructor', () => {
		it('should initialize with valid options', () => {
			assert.equal(session.isAuthenticated, false)
			assert.equal(session['state'], SecureSessionState.INITIAL)
			assert.equal(session['deviceAuthHash'], mockDeviceAuthHash)
			assert.equal(session['passwordHash'], mockPasswordHash)
		})

		it('should throw on invalid user ID', () => {
			assert.throws(
				() => {
					const newSession = new SecureSession({
						...mockOptions,
						userId: KNX_SECURE.USER.USER_MAX + 1,
					})
				},
				{
					message: KNX_SECURE.ERROR.INVALID_USER_ID,
				},
			)
		})
	})

	describe('Session Start', () => {
		it('should generate valid session request', () => {
			const request = session.start()

			assert(request instanceof SessionRequest)
			assert.equal(session['state'], SecureSessionState.AUTHENTICATING)
			assert.deepEqual(session['clientKeyPair'], mockKeyPair)
		})

		it('should not allow multiple starts', () => {
			session.start()
			assert.throws(
				() => {
					session.start()
				},
				{
					message: 'Session already started',
				},
			)
		})

		it('should set authentication timeout', () => {
			session.start()

			let timeoutCalled = false
			let closeCalled = false

			session.once('timeout', (reason) => {
				timeoutCalled = true
				assert.equal(reason, 'Authentication timeout')
				assert.equal(session['state'], SecureSessionState.CLOSED)
			})

			session.once('close', () => {
				closeCalled = true
				assert.equal(session['state'], SecureSessionState.CLOSED)
			})

			clock.tick(KNX_SECURE.TIMEOUT.AUTHENTICATION * 1000 + 100)

			assert(timeoutCalled, 'Timeout event not called')
			assert(closeCalled, 'Close event not called')
		})
	})

	describe('Session Response Handling', () => {
		beforeEach(() => {
			session.start()
		})

		it('should process valid session response', () => {
			SecurityUtils.deriveDeviceAuthenticationCode = () =>
				mockDeviceAuthHash
			SecurityUtils.derivePasswordHash = () => mockPasswordHash
			SecurityUtils.calculateSessionKey = () => mockSessionKey

			session['state'] = SecureSessionState.AUTHENTICATING
			session['clientKeyPair'] = {
				publicKey: MOCK.CLIENT_KEY,
				privateKey: Buffer.alloc(32),
			}

			const mockResponse = new SessionResponse(
				MOCK.SESSION_ID,
				MOCK.SERVER_KEY,
				MOCK.MAC,
			)

			const verifyMACStub = sinon.stub(mockResponse, 'verifyMAC')
			verifyMACStub.returns(true)

			try {
				const auth = session.handleSessionResponse(mockResponse)

				assert(auth instanceof SessionAuthenticate)
				assert.equal(session['sessionId'], MOCK.SESSION_ID)
				assert.deepEqual(session['serverPublicKey'], MOCK.SERVER_KEY)
				assert.deepEqual(session['sessionKey'], mockSessionKey)

				assert(
					verifyMACStub.calledWith(
						mockDeviceAuthHash,
						MOCK.CLIENT_KEY,
						MOCK.SERIAL_NUMBER,
					),
				)
			} finally {
				verifyMACStub.restore()
			}
		})

		it('should reject invalid MAC', () => {
			const mockResponse = new SessionResponse(
				MOCK.SESSION_ID,
				MOCK.SERVER_KEY,
				MOCK.MAC,
			)
			mockResponse.verifyMAC = () => false

			assert.throws(() => session.handleSessionResponse(mockResponse), {
				message: KNX_SECURE.ERROR.MAC_VERIFICATION,
			})
		})

		it('should reject response in wrong state', () => {
			session['state'] = SecureSessionState.INITIAL

			const mockResponse = new SessionResponse(
				MOCK.SESSION_ID,
				MOCK.SERVER_KEY, // 32 bytes ECDH public key
				MOCK.MAC, // 16 bytes MAC
			)

			assert.throws(
				() => {
					session.handleSessionResponse(mockResponse)
				},
				{
					message: 'Invalid state for session response',
				},
			)
		})
	})

	describe('Session Status Handling', () => {
		beforeEach(() => {
			session.start()
		})

		it('should handle successful authentication', () => {
			let authenticated = false
			session.on('authenticated', () => {
				authenticated = true
			})

			session.handleSessionStatus(
				new SessionStatus(SecureSessionStatus.AUTHENTICATION_SUCCESS),
			)

			assert(authenticated)
			assert.equal(session['state'], SecureSessionState.AUTHENTICATED)
			assert(session.isAuthenticated)
		})

		it('should handle authentication failure', async () => {
			let closed = false
			session.on('close', (reason) => {
				assert.equal(reason, 'Authentication failed')
				closed = true
			})

			session['state'] = SecureSessionState.AUTHENTICATING
			session.handleSessionStatus(
				new SessionStatus(SecureSessionStatus.AUTHENTICATION_FAILED),
			)

			assert(closed)
		})

		it('should handle session timeout', () => {
			let timeoutCalled = false
			let stateChanged = false

			session.once('timeout', (reason) => {
				timeoutCalled = true
				assert.equal(reason, 'Session timeout')
				assert.equal(session['state'], SecureSessionState.CLOSED)
			})

			session.once('close', () => {
				stateChanged = true
				assert.equal(session['state'], SecureSessionState.CLOSED)
			})

			clearTimeout(session['authenticationTimer'])
			clearTimeout(session['sessionTimer'])

			session['state'] = SecureSessionState.AUTHENTICATED
			session['startSessionTimer']()

			clock.tick(KNX_SECURE.TIMEOUT.SESSION * 1000 + 100)

			assert(timeoutCalled, 'Timeout event not fired')
			assert(stateChanged, 'State not changed to CLOSED')
			assert.equal(
				session['state'],
				SecureSessionState.CLOSED,
				'Session should be closed',
			)
		})

		it('should process keepalive messages', () => {
			session['state'] = SecureSessionState.AUTHENTICATED
			let timerReset = false

			const originalResetTimer =
				session['resetSessionTimer'].bind(session)
			session['resetSessionTimer'] = () => {
				timerReset = true
				originalResetTimer()
			}

			session.handleSessionStatus(
				new SessionStatus(SecureSessionStatus.KEEPALIVE),
			)
			assert(timerReset)
		})
	})

	describe('Data Wrapping/Unwrapping', () => {
		const MOCK_DATA = Buffer.from('test-data')

		beforeEach(() => {
			session.start()
			session['state'] = SecureSessionState.AUTHENTICATED
			session['sessionKey'] = mockSessionKey
			session['sessionId'] = MOCK.SESSION_ID
			session['sequenceNumber'] = 0
		})

		it('should wrap data correctly', () => {
			let wrapCalled = false

			// Mock the wrap function according to KNX spec
			SecureWrapper.wrap = (
				data,
				sessionId,
				seqNumber,
				serial,
				tag,
				key,
			) => {
				assert.equal(sessionId, MOCK.SESSION_ID)
				assert.equal(seqNumber, 0) // First sequence number
				assert.equal(serial, MOCK.SERIAL_NUMBER)
				assert.equal(key, mockSessionKey)
				wrapCalled = true

				return new SecureWrapper(
					sessionId,
					seqNumber,
					serial,
					tag,
					data,
					MOCK.MAC,
				)
			}

			session.wrapData(MOCK_DATA)

			assert(wrapCalled)
		})

		it('should unwrap data correctly', () => {
			const wrapper = new SecureWrapper(
				MOCK.SESSION_ID,
				1, // Valid sequence number
				MOCK.SERIAL_NUMBER,
				0, // Message tag
				MOCK_DATA,
				MOCK.MAC,
			)

			SecurityUtils.validateTunnelingSequence = () => true

			let unwrapCalled = false
			SecureWrapper.unwrap = (w, key) => {
				assert.deepEqual(w, wrapper)
				assert.equal(key, mockSessionKey)
				unwrapCalled = true
				return MOCK_DATA
			}

			const result = session.unwrapData(wrapper)

			assert(unwrapCalled)
			assert.deepEqual(result, MOCK_DATA)
		})

		it('should reject invalid session ID', () => {
			const wrapper = new SecureWrapper(
				MOCK.SESSION_ID + 1, // Different session ID
				0, // Sequence number
				MOCK.SERIAL_NUMBER,
				0, // Message tag
				MOCK.DATA,
				MOCK.MAC, // 16 bytes MAC
			)

			assert.throws(
				() => {
					session.unwrapData(wrapper)
				},
				{
					message: 'Invalid session ID',
				},
			)
		})

		it('should reject invalid sequence number', () => {
			const wrapper = new SecureWrapper(
				MOCK.SESSION_ID,
				0, // Invalid sequence
				MOCK.SERIAL_NUMBER,
				0,
				MOCK.DATA,
				MOCK.MAC, // 16 bytes MAC
			)

			SecurityUtils.validateTunnelingSequence = () => false

			assert.throws(
				() => {
					session.unwrapData(wrapper)
				},
				{
					message: 'Invalid sequence number',
				},
			)
		})

		it('should reject operations when not authenticated', () => {
			session['state'] = SecureSessionState.INITIAL
			const data = Buffer.from('test-data')

			assert.throws(
				() => {
					session.wrapData(data)
				},
				{
					message: 'Session not authenticated',
				},
			)
		})
	})

	describe('Session Management', () => {
		it('should close session properly', () => {
			let closeReason = ''
			session.on('close', (reason) => {
				closeReason = reason
			})

			session['state'] = SecureSessionState.AUTHENTICATED
			session.close('Test close')

			assert.equal(closeReason, 'Test close')
			assert.equal(session['state'], SecureSessionState.CLOSED)
		})

		it('should reset session timer', () => {
			session['state'] = SecureSessionState.AUTHENTICATED
			session['startSessionTimer']()

			const originalTimer = session['sessionTimer']
			session['resetSessionTimer']()

			assert.notEqual(session['sessionTimer'], originalTimer)
		})
	})

	describe('State Getters', () => {
		it('should return correct authentication state', () => {
			assert(!session.isAuthenticated)
			session['state'] = SecureSessionState.AUTHENTICATED
			assert(session.isAuthenticated)
		})

		it('should return correct session ID', () => {
			assert.equal(session.currentSessionId, 0)
			session['sessionId'] = 1
			assert.equal(session.currentSessionId, 1)
		})

		it('should return correct sequence number', () => {
			assert.equal(session.currentSequenceNumber, 0)
			session['sequenceNumber'] = 1
			assert.equal(session.currentSequenceNumber, 1)
		})
	})
})
