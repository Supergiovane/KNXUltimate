import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import KNXSecureTunnelling from '../../src/secure/KNXSecureTunnelling'
import { SecureSessionOptions } from '../../src/secure/SecureSession'
import { SessionStatus } from '../../src/secure/messages/SessionMessages'
import { KNX_SECURE } from '../../src/secure/SecureConstants'
import KNXTunnellingRequest from '../../src/protocol/KNXTunnellingRequest'
import CEMIFactory from '../../src/protocol/cEMI/CEMIFactory'
import {
	FrameType,
	OnOff,
	Priority,
} from '../../src/protocol/cEMI/ControlField'
import KNXAddress from '../../src/protocol/KNXAddress'
import { KNX_CONSTANTS } from '../../src/protocol/KNXConstants'
import {
	SecurityUtils,
	MessageType,
} from '../../src/secure/crypto/SecurityUtils'
import KNXDataBuffer from '../../src/protocol/KNXDataBuffer'
import KNXHeader from '../../src/protocol/KNXHeader'
import SecureWrapper from '../../src/secure/messages/SecureWrapper'

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

			secureTunnel.on('send', (w) => {
				if (!wrapper1) {
					wrapper1 = w
				} else {
					wrapper2 = w
				}
			})

			const req1 = createMockTunnellingRequest()
			secureTunnel.sendTunnellingRequest(req1)

			const req2 = createMockTunnellingRequest()
			secureTunnel.sendTunnellingRequest(req2)

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
			let prevWrapper: any
			secureTunnel.on('send', (w) => {
				prevWrapper = lastWrapper
				lastWrapper = w
			})

			// Set sequence number to 255
			for (let i = 0; i <= 255; i++) {
				secureTunnel.sendTunnellingRequest(
					createMockTunnellingRequest(),
				)
			}

			assert.equal(lastWrapper.sequenceInfo, 255, 'Should reach 255')

			// Send one more request which should wrap to 0
			secureTunnel.sendTunnellingRequest(createMockTunnellingRequest())

			assert.equal(lastWrapper.sequenceInfo, 0, 'Should wrap back to 0')
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

			secureTunnel.on('tunnellingRequest', (request) => {
				assert.ok(request instanceof KNXTunnellingRequest)
				done()
			})

			const wrapper = createMockSecureWrapper(
				KNX_CONSTANTS.TUNNELLING_REQUEST,
			)

			secureTunnel.handleSecureWrapper(wrapper)
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
			const session = setupEstablishedConnection(secureTunnel)

			let disconnectSent = false
			secureTunnel.on('send', (wrapper) => {
				const decryptedData = SecurityUtils.decrypt(
					wrapper.encapsulatedData,
					wrapper.messageAuthenticationCode,
					{
						messageType: MessageType.SECURE_WRAPPER,
						knxHeader: wrapper.toHeader().toBuffer(),
						secureSessionId: Buffer.alloc(2),
						encapsulatedFrame: wrapper.encapsulatedData,
					},
					secureTunnel['session']['sessionKey'],
					{
						channelId: wrapper.sessionId,
						sequenceNumber: wrapper.sequenceInfo,
						serialNumber: wrapper.serialNumber,
						messageTag: wrapper.messageTag,
						messageType: MessageType.SECURE_WRAPPER,
					},
				)

				const serviceType = decryptedData.readUInt16BE(2)
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
function setupEstablishedConnection(tunnel: KNXSecureTunnelling): any {
	const session = simulateSecureSession()

	tunnel['session']['sessionKey'] = session.sessionKey
	tunnel['session']['sequenceNumber'] = 0

	tunnel.connect()

	const sessionResponse = {
		sessionId: 1,
		publicKey: session.serverKeyPair.publicKey,
		messageAuthenticationCode: Buffer.alloc(16, 1),
		verifyMAC: () => true,
	} as any

	const sessionAuth = tunnel.handleSessionResponse(sessionResponse)

	const authSuccess = new SessionStatus(
		KNX_SECURE.SESSION_STATUS.AUTHENTICATION_SUCCESS,
	)
	tunnel.handleSessionStatus(authSuccess)

	tunnel.handleConnectResponse(1)

	return session
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

	// Creare il cEMI message con il messaggio code corretto (L_DATA_REQ = 0x11)
	const cEMIMessage = CEMIFactory.newLDataRequestMessage(
		'write',
		srcAddr,
		dstAddr,
		new KNXDataBuffer(Buffer.from([0x00, 0x80])),
	)

	// Impostare i campi di controllo secondo le specifiche KNX
	cEMIMessage.control.frameType = FrameType.type1 // Standard frame
	cEMIMessage.control.repeat = OnOff.on // Repeat enabled
	cEMIMessage.control.broadcast = OnOff.on // System broadcast
	cEMIMessage.control.priority = Priority.Prio3 // Low priority
	cEMIMessage.control.ack = OnOff.off // No acknowledge requested
	cEMIMessage.control.error = OnOff.off // No error

	// Control2 fields
	cEMIMessage.control.addressType = KNXAddress.TYPE_GROUP // 1 for group address
	cEMIMessage.control.hopCount = 6 // Standard hop count
	cEMIMessage.control.frameFormat = 0 // Standard frame format

	// Create tunnelling request with explicit sequence counter
	const tunnelReq = new KNXTunnellingRequest(
		1, // channelId
		0, // seqCounter
		cEMIMessage,
	)

	return tunnelReq
}

function createMockSecureWrapper(
	serviceType: number,
	sequenceNumber = 1,
): SecureWrapper {
	// Create valid tunnelling request
	const tunnelReq = createMockTunnellingRequest()
	const tunnelBuffer = tunnelReq.toBuffer()

	// Create KNX header for the secure wrapper
	const header = new KNXHeader(
		KNX_SECURE.SERVICE_TYPE.SECURE_WRAPPER,
		tunnelBuffer.length + 16, // Data length + MAC length
	)

	// Get secure session
	const session = simulateSecureSession()

	// Create secure session ID buffer
	const sessionIdBuffer = Buffer.alloc(2)
	sessionIdBuffer.writeUInt16BE(1) // session ID = 1

	// Setup data for encryption
	const secureData = {
		messageType: MessageType.SECURE_WRAPPER,
		knxHeader: header.toBuffer(),
		secureSessionId: sessionIdBuffer,
		encapsulatedFrame: tunnelBuffer, // Only the tunnelling request, not the header
	}

	// Encrypt with CCM parameters
	const config = {
		channelId: 1,
		sequenceNumber,
		serialNumber: 12345678,
		messageTag: 0,
		messageType: MessageType.SECURE_WRAPPER,
	}

	const { ciphertext, mac } = SecurityUtils.encrypt(
		secureData,
		session.sessionKey,
		config,
	)

	return new SecureWrapper(
		1, // sessionId
		sequenceNumber, // sequenceInfo
		12345678, // serialNumber
		0, // messageTag
		ciphertext, // encrypted data
		mac, // MAC
	)
}
