import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import KNXSecureTunnelling from '../../src/secure/KNXSecureTunnelling'
import { SecureSessionOptions } from '../../src/secure/SecureSession'
import { SessionStatus } from '../../src/secure/messages/SessionMessages'
import { KNX_SECURE } from '../../src/secure/SecureConstants'
import KNXTunnellingRequest from '../../src/protocol/KNXTunnellingRequest'
import CEMIFactory from '../../src/protocol/cEMI/CEMIFactory'
import KNXAddress from '../../src/protocol/KNXAddress'
import { KNX_CONSTANTS } from '../../src/protocol/KNXConstants'
import { SecurityUtils } from '../../src/secure/crypto/SecurityUtils'

describe('KNXSecureTunnelling', () => {
	let secureTunnel: KNXSecureTunnelling
	const mockOptions: SecureSessionOptions = {
		deviceAuthCode: 'TEST-AUTH-CODE',
		userId: KNX_SECURE.USER.MANAGEMENT,
		password: 'test-password',
		serialNumber: 12345678,
	}

	beforeEach(() => {
		secureTunnel = new KNXSecureTunnelling(mockOptions)
	})

	afterEach(() => {
		secureTunnel.removeAllListeners()
		secureTunnel.close()
	})

	describe('Connection Setup', () => {
		it('should start secure session on connect', () => {
			const request = secureTunnel.connect()
			assert.ok(request, 'Should return session request')
			assert.equal(
				secureTunnel.isEstablished,
				false,
				'Should not be established yet',
			)
		})

		it('should throw when connecting twice', () => {
			secureTunnel.connect()
			assert.throws(
				() => secureTunnel.connect(),
				/Session already started/,
			)
		})

		it('should emit established event on successful connection', async () => {
			let established = false
			secureTunnel.on('established', () => {
				established = true
			})

			// 1. Start connection
			const request = secureTunnel.connect()
			assert.ok(request, 'Should return session request')

			// 2. Handle session response with valid ECDH parameters
			const sessionResponse = {
				sessionId: 1,
				publicKey: Buffer.alloc(32, 1), // Server's valid ECDH public value Y
				messageAuthenticationCode: Buffer.alloc(16, 1),
				verifyMAC: () => true, // Mock successful MAC verification
			} as any

			const sessionAuth =
				secureTunnel.handleSessionResponse(sessionResponse)
			assert.ok(sessionAuth, 'Should return session authenticate')

			// 3. Handle successful authentication
			secureTunnel.handleSessionStatus(
				new SessionStatus(
					KNX_SECURE.SESSION_STATUS.AUTHENTICATION_SUCCESS,
				),
			)

			// 4. Complete connection
			secureTunnel.handleConnectResponse(1)

			assert.equal(secureTunnel.isEstablished, true)
			assert.equal(established, true)
		})
	})

	describe('Session Status Handling', () => {
		it('should close on authentication failure', () => {
			let closed = false
			secureTunnel.on('closed', () => {
				closed = true
			})

			const authFailed = new SessionStatus(
				KNX_SECURE.SESSION_STATUS.AUTHENTICATION_FAILED,
			)
			secureTunnel.handleSessionStatus(authFailed)

			assert.equal(closed, true)
			assert.equal(secureTunnel.isEstablished, false)
		})

		it('should close on session timeout', () => {
			let closed = false
			secureTunnel.on('closed', () => {
				closed = true
			})

			const timeout = new SessionStatus(KNX_SECURE.SESSION_STATUS.TIMEOUT)
			secureTunnel.handleSessionStatus(timeout)

			assert.equal(closed, true)
		})
	})

	describe('Tunnelling Requests', () => {
		beforeEach((t, done) => {
			// Setup established connection
			secureTunnel.on('established', done)
			setupEstablishedConnection(secureTunnel)
		})

		it('should send tunnelling request with incrementing sequence number', () => {
			let wrapper1: any
			let wrapper2: any

			console.log('DEBUG - Test start:', {
				currentSequence: secureTunnel['sequenceNumber'],
			})

			secureTunnel.on('send', (w) => {
				console.log('DEBUG - Send event:', {
					wrapper: w,
					currentSequence: secureTunnel['sequenceNumber'],
					wrapperSequenceInfo: w.sequenceInfo,
				})

				if (!wrapper1) {
					wrapper1 = w
					console.log('DEBUG - Saved wrapper1')
				} else {
					wrapper2 = w
					console.log('DEBUG - Saved wrapper2')
				}
			})

			const req1 = createMockTunnellingRequest()
			console.log('DEBUG - Sending request 1')
			secureTunnel.sendTunnellingRequest(req1)

			const req2 = createMockTunnellingRequest()
			console.log('DEBUG - Sending request 2')
			secureTunnel.sendTunnellingRequest(req2)

			console.log('DEBUG - Final wrappers:', {
				wrapper1SequenceInfo: wrapper1?.sequenceInfo,
				wrapper2SequenceInfo: wrapper2?.sequenceInfo,
				finalSequence: secureTunnel['sequenceNumber'],
			})

			assert.equal(
				wrapper1.sequenceInfo,
				0,
				'First wrapper should have sequence info 0',
			)
			assert.equal(
				wrapper2.sequenceInfo,
				1,
				'Second wrapper should have sequence info 1',
			)
		})

		it('should wrap sequence number back to 0 after 255', () => {
			let lastWrapper: any
			secureTunnel.on('send', (w) => {
				lastWrapper = w
			})

			// Set sequence number to 255
			for (let i = 0; i < 255; i++) {
				secureTunnel.sendTunnellingRequest(
					createMockTunnellingRequest(),
				)
			}

			// Send one more request
			secureTunnel.sendTunnellingRequest(createMockTunnellingRequest())

			assert.equal(lastWrapper.sequenceNumber, 0)
		})

		it('should throw when sending request before establishment', () => {
			const tunnel = new KNXSecureTunnelling(mockOptions)
			assert.throws(
				() =>
					tunnel.sendTunnellingRequest(createMockTunnellingRequest()),
				/Tunnel not established/,
			)
		})
	})

	describe('Secure Wrapper Handling', () => {
		it('should emit tunnelling request on wrapper', (t, done) => {
			setupEstablishedConnection(secureTunnel)

			console.log('DEBUG - Before wrapper handling:', {
				isEstablished: secureTunnel.isEstablished,
				sessionState: secureTunnel['session']['state'],
			})

			secureTunnel.on('tunnellingRequest', (request) => {
				console.log('DEBUG - TunnellingRequest event:', request)
				assert.ok(request instanceof KNXTunnellingRequest)
				done()
			})

			const wrapper = createMockSecureWrapper(
				KNX_CONSTANTS.TUNNELLING_REQUEST,
			)
			console.log('DEBUG - Mock wrapper:', wrapper)

			try {
				secureTunnel.handleSecureWrapper(wrapper)
			} catch (error) {
				console.error('DEBUG - Wrapper handling error:', error.message)
				throw error
			}
		})

		it('should close on disconnect request wrapper', () => {
			setupEstablishedConnection(secureTunnel)

			let closeReason: string
			secureTunnel.on('closed', (reason) => {
				closeReason = reason
			})

			const wrapper = createMockSecureWrapper(
				KNX_CONSTANTS.DISCONNECT_REQUEST,
			)
			secureTunnel.handleSecureWrapper(wrapper)

			assert.equal(closeReason, 'Disconnect requested by peer')
		})

		it('should emit error on invalid wrapper', () => {
			setupEstablishedConnection(secureTunnel)

			let error: Error
			secureTunnel.on('error', (err) => {
				error = err
			})

			const invalidWrapper = {} as any
			secureTunnel.handleSecureWrapper(invalidWrapper)

			assert.ok(error instanceof Error)
		})

		it('should handle keepalive status', () => {
			setupEstablishedConnection(secureTunnel)

			const keepalive = new SessionStatus(
				KNX_SECURE.SESSION_STATUS.KEEPALIVE,
			)
			secureTunnel.handleSessionStatus(keepalive)

			assert.equal(secureTunnel.isEstablished, true)
		})
	})

	describe('Cleanup', () => {
		it('should send disconnect request on close if established', () => {
			setupEstablishedConnection(secureTunnel)

			let disconnectSent = false
			secureTunnel.on('send', (wrapper) => {
				const data = Buffer.from(wrapper.encapsulatedData)
				const serviceType = data.readUInt16BE(2)
				if (serviceType === KNX_CONSTANTS.DISCONNECT_REQUEST) {
					disconnectSent = true
				}
			})

			secureTunnel.close()
			assert.equal(disconnectSent, true)
		})

		it('should reset channel id on close', () => {
			setupEstablishedConnection(secureTunnel)
			assert.ok(secureTunnel.isEstablished)

			secureTunnel.close()
			assert.equal(secureTunnel.isEstablished, false)
		})

		it('should handle force close without sending disconnect', () => {
			secureTunnel.close('Force close')
			assert.equal(secureTunnel.isEstablished, false)
		})
	})
})

// Helper functions
function setupEstablishedConnection(tunnel: KNXSecureTunnelling) {
	console.log('DEBUG - Setting up established connection')

	tunnel['sequenceNumber'] = 0

	tunnel.connect()

	const sessionResponse = {
		sessionId: 1,
		publicKey: Buffer.alloc(32, 1),
		messageAuthenticationCode: Buffer.alloc(16, 1),
		verifyMAC: () => true,
	} as any

	const sessionAuth = tunnel.handleSessionResponse(sessionResponse)

	const authSuccess = new SessionStatus(
		KNX_SECURE.SESSION_STATUS.AUTHENTICATION_SUCCESS,
	)
	tunnel.handleSessionStatus(authSuccess)

	tunnel.handleConnectResponse(1)

	console.log('DEBUG - Connection setup complete:', {
		isEstablished: tunnel.isEstablished,
		channelId: tunnel['channelId'],
		sessionState: tunnel['session']['state'],
	})

	return sessionAuth
}

function simulateSecureSession() {
	const clientKeyPair = SecurityUtils.generateKeyPair()
	const serverKeyPair = SecurityUtils.generateKeyPair()

	const sessionKey = SecurityUtils.calculateSessionKey(
		clientKeyPair.privateKey,
		serverKeyPair.publicKey,
	)

	return {
		sessionKey,
		clientKeyPair,
		serverKeyPair,
	}
}

function createMockTunnellingRequest() {
	const srcAddr = KNXAddress.createFromString('1.1.1')
	const dstAddr = KNXAddress.createFromString('1/1/1')
	const cEMIMessage = CEMIFactory.newLDataRequestMessage(
		'write',
		srcAddr,
		dstAddr,
		null,
	)
	return new KNXTunnellingRequest(1, 0, cEMIMessage)
}

function createMockSecureWrapper(serviceType: number, sequenceNumber = 0) {
	const header = Buffer.alloc(6)
	header.writeUInt16BE(serviceType, 2)

	return {
		sessionId: 1,
		sequenceInfo: sequenceNumber,
		serialNumber: 12345678,
		messageTag: 0,
		encapsulatedData: header,
		messageAuthenticationCode: Buffer.alloc(16, 1),
		// According to spec, unwrap should decrypt data
		unwrapData: () => header,
		toBuffer: () => Buffer.concat([header, Buffer.alloc(32)]),
	} as any
}
