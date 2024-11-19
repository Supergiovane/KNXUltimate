import { describe, it, beforeEach } from 'node:test'
import assert from 'assert'
import KNXProtocol from '../../src/protocol/KNXProtocol'
import KNXHeader from '../../src/protocol/KNXHeader'
import HPAI from '../../src/protocol/HPAI'
import TunnelCRI from '../../src/protocol/TunnelCRI'
import CEMIMessage from '../../src/protocol/cEMI/CEMIMessage'
import { KNX_CONSTANTS } from '../../src/protocol/KNXConstants'
import { KNX_SECURE } from '../../src/secure/SecureConstants'
import KNXSearchRequest from '../../src/protocol/KNXSearchRequest'
import KNXDescriptionRequest from '../../src/protocol/KNXDescriptionRequest'
import KNXConnectRequest from '../../src/protocol/KNXConnectRequest'
import KNXConnectionStateRequest from '../../src/protocol/KNXConnectionStateRequest'
import KNXDisconnectRequest from '../../src/protocol/KNXDisconnectRequest'
import KNXDisconnectResponse from '../../src/protocol/KNXDisconnectResponse'
import KNXTunnellingAck from '../../src/protocol/KNXTunnellingAck'
import KNXTunnellingRequest from '../../src/protocol/KNXTunnellingRequest'
import KNXRoutingIndication from '../../src/protocol/KNXRoutingIndication'
import SecureWrapper from '../../src/secure/messages/SecureWrapper'
import { SessionRequest } from '../../src/secure/messages/SessionMessages'

describe('KNXProtocol', () => {
	let mockHPAI: HPAI
	let mockTunnelCRI: TunnelCRI
	let mockCEMIMessage: CEMIMessage
	let mockSessionKey: Buffer
	let mockPublicKey: Buffer
	let mockClientPublicKey: Buffer
	let mockServerPublicKey: Buffer
	let mockSerialNumber: number
	let mockDeviceAuthCode: Buffer
	let mockPasswordHash: Buffer

	beforeEach(() => {
		mockHPAI = new HPAI('192.168.1.1', 3671, KNX_CONSTANTS.IPV4_UDP)
		mockTunnelCRI = new TunnelCRI(KNX_CONSTANTS.TUNNEL_LINKLAYER)
		mockCEMIMessage = {} as CEMIMessage
		mockSessionKey = Buffer.alloc(16, 1) // 16 byte key
		mockPublicKey = Buffer.alloc(32, 2) // 32 byte Curve25519 key
		mockClientPublicKey = Buffer.alloc(32, 2)
		mockServerPublicKey = Buffer.alloc(32, 3)
		mockPasswordHash = Buffer.alloc(16, 4)
		mockSerialNumber = 12345678
		mockDeviceAuthCode = Buffer.alloc(16, 3)
	})

	describe('Standard KNX Messages', () => {
		describe('parseMessage', () => {
			it('should parse KNXSearchRequest correctly', () => {
				const mockBuffer = Buffer.from([
					0x06,
					0x10,
					0x02,
					0x01,
					0x00,
					0x0e,
					...mockHPAI.toBuffer(),
				])
				const result = KNXProtocol.parseMessage(mockBuffer)
				assert(result.knxHeader instanceof KNXHeader)
				assert(result.knxMessage instanceof KNXSearchRequest)
			})

			it('should handle unknown message types', () => {
				const mockBuffer = Buffer.from([
					0x06, 0x10, 0xff, 0xff, 0x00, 0x0e,
				])
				const result = KNXProtocol.parseMessage(mockBuffer)
				assert(result.knxHeader instanceof KNXHeader)
				assert(result.knxMessage === undefined)
			})
		})

		describe('Standard Message Creation', () => {
			it('should create KNXSearchRequest', () => {
				const result = KNXProtocol.newKNXSearchRequest(mockHPAI)
				assert(result instanceof KNXSearchRequest)
				assert.deepStrictEqual(result.hpai, mockHPAI)
			})

			it('should create KNXDescriptionRequest', () => {
				const result = KNXProtocol.newKNXDescriptionRequest(mockHPAI)
				assert(result instanceof KNXDescriptionRequest)
				assert.deepStrictEqual(result.hpai, mockHPAI)
			})

			it('should create KNXConnectRequest with default HPAIs', () => {
				const result = KNXProtocol.newKNXConnectRequest(mockTunnelCRI)
				assert(result instanceof KNXConnectRequest)
				assert.deepStrictEqual(result.cri, mockTunnelCRI)
				assert.deepStrictEqual(result.hpaiControl, HPAI.NULLHPAI)
				assert.deepStrictEqual(result.hpaiData, HPAI.NULLHPAI)
			})

			it('should create KNXConnectRequest with custom HPAIs', () => {
				const result = KNXProtocol.newKNXConnectRequest(
					mockTunnelCRI,
					mockHPAI,
					mockHPAI,
				)
				assert(result instanceof KNXConnectRequest)
				assert.deepStrictEqual(result.cri, mockTunnelCRI)
				assert.deepStrictEqual(result.hpaiControl, mockHPAI)
				assert.deepStrictEqual(result.hpaiData, mockHPAI)
			})

			it('should create KNXConnectionStateRequest with default HPAI', () => {
				const result = KNXProtocol.newKNXConnectionStateRequest(1)
				assert(result instanceof KNXConnectionStateRequest)
				assert.strictEqual(result.channelID, 1)
				assert.deepStrictEqual(result.hpaiControl, HPAI.NULLHPAI)
			})

			it('should create KNXConnectionStateRequest with custom HPAI', () => {
				const result = KNXProtocol.newKNXConnectionStateRequest(
					1,
					mockHPAI,
				)
				assert(result instanceof KNXConnectionStateRequest)
				assert.strictEqual(result.channelID, 1)
				assert.deepStrictEqual(result.hpaiControl, mockHPAI)
			})

			it('should create KNXDisconnectRequest with default HPAI', () => {
				const result = KNXProtocol.newKNXDisconnectRequest(1)
				assert(result instanceof KNXDisconnectRequest)
				assert.strictEqual(result.channelID, 1)
				assert.deepStrictEqual(result.hpaiControl, HPAI.NULLHPAI)
			})

			it('should create KNXDisconnectRequest with custom HPAI', () => {
				const result = KNXProtocol.newKNXDisconnectRequest(1, mockHPAI)
				assert(result instanceof KNXDisconnectRequest)
				assert.strictEqual(result.channelID, 1)
				assert.deepStrictEqual(result.hpaiControl, mockHPAI)
			})

			it('should create KNXDisconnectResponse', () => {
				const result = KNXProtocol.newKNXDisconnectResponse(1, 0)
				assert(result instanceof KNXDisconnectResponse)
				assert.strictEqual(result.channelID, 1)
				assert.strictEqual(result.status, 0)
			})

			it('should create KNXTunnellingACK', () => {
				const result = KNXProtocol.newKNXTunnellingACK(1, 2, 0)
				assert(result instanceof KNXTunnellingAck)
				assert.strictEqual(result.channelID, 1)
				assert.strictEqual(result.seqCounter, 2)
				assert.strictEqual(result.status, 0)
			})

			it('should create KNXTunnellingRequest', () => {
				const result = KNXProtocol.newKNXTunnellingRequest(
					1,
					2,
					mockCEMIMessage,
				)
				assert(result instanceof KNXTunnellingRequest)
				assert.strictEqual(result.channelID, 1)
				assert.strictEqual(result.seqCounter, 2)
				assert.deepStrictEqual(result.cEMIMessage, mockCEMIMessage)
			})

			it('should create KNXRoutingIndication', () => {
				const result =
					KNXProtocol.newKNXRoutingIndication(mockCEMIMessage)
				assert(result instanceof KNXRoutingIndication)
				assert.deepStrictEqual(result.cEMIMessage, mockCEMIMessage)
			})
		})
	})

	describe('Secure Messages', () => {
		describe('parseSecureMessage', () => {
			it('should parse SESSION_REQUEST correctly', () => {
				const mockBuffer = Buffer.concat([
					new KNXHeader(
						KNX_SECURE.SERVICE_TYPE.SESSION_REQUEST,
						40,
					).toBuffer(),
					mockHPAI.toBuffer(),
					mockPublicKey,
				])
				const result = KNXProtocol.parseSecureMessage(mockBuffer)
				assert(result.secureMessage instanceof SessionRequest)
				assert.deepStrictEqual(
					(result.secureMessage as SessionRequest).publicKey,
					mockPublicKey,
				)
			})

			it('should parse SECURE_WRAPPER correctly', () => {
				const wrappedData = Buffer.from([1, 2, 3, 4])
				const mockWrapper = SecureWrapper.wrap(
					wrappedData,
					1,
					1,
					mockSerialNumber,
					0,
					mockSessionKey,
				)
				const mockBuffer = Buffer.concat([
					new KNXHeader(
						KNX_SECURE.SERVICE_TYPE.SECURE_WRAPPER,
						mockWrapper.toBuffer().length,
					).toBuffer(),
					mockWrapper.toBuffer(),
				])

				const result = KNXProtocol.parseSecureMessage(mockBuffer)
				assert(result.secureMessage instanceof SecureWrapper)
			})

			it('should throw on unknown secure service type', () => {
				const mockBuffer = Buffer.concat([
					new KNXHeader(0xffff, 1).toBuffer(),
					Buffer.from([0]),
				])
				assert.throws(
					() => KNXProtocol.parseSecureMessage(mockBuffer),
					/Unknown secure service type/,
				)
			})
		})

		describe('Secure Message Creation', () => {
			it('should create SecureConnectRequest', () => {
				const sessionId = 1
				const sequenceNumber = 1
				const messageTag = 0

				const result = KNXProtocol.newSecureConnectRequest(
					mockTunnelCRI,
					sessionId,
					sequenceNumber,
					mockSerialNumber,
					messageTag,
					mockSessionKey,
				)

				assert(result instanceof SecureWrapper)

				// Unwrap and verify connect request
				const unwrapped = SecureWrapper.unwrap(result, mockSessionKey)

				const header = KNXHeader.createFromBuffer(unwrapped)

				const remaining = unwrapped.subarray(header.headerLength)

				const hpai1 = HPAI.createFromBuffer(remaining)

				const hpai2 = HPAI.createFromBuffer(remaining.subarray(8))

				const connectRequest =
					KNXConnectRequest.createFromBuffer(remaining)

				assert(connectRequest instanceof KNXConnectRequest)
				assert.deepStrictEqual(
					connectRequest.hpaiControl,
					HPAI.NULLHPAI,
				)
				assert.deepStrictEqual(connectRequest.hpaiData, HPAI.NULLHPAI)
				assert.deepStrictEqual(connectRequest.cri, mockTunnelCRI)
			})

			it('should create SecureDisconnectRequest', () => {
				const channelId = 1

				const result = KNXProtocol.newSecureDisconnectRequest(
					channelId,
					1,
					1,
					mockSerialNumber,
					0,
					mockSessionKey,
				)

				assert(result instanceof SecureWrapper)
				const unwrapped = SecureWrapper.unwrap(result, mockSessionKey)
				const disconnectRequest = KNXDisconnectRequest.createFromBuffer(
					unwrapped.subarray(6),
				)
				assert(disconnectRequest instanceof KNXDisconnectRequest)
				assert.strictEqual(disconnectRequest.channelID, channelId)
			})

			it('should create and validate SessionResponse', () => {
				const result = KNXProtocol.newSessionResponse(
					1,
					mockPublicKey,
					mockDeviceAuthCode,
					mockPublicKey,
					mockSerialNumber,
				)
				assert(
					result.verifyMAC(
						mockDeviceAuthCode,
						mockPublicKey,
						mockSerialNumber,
					),
				)
			})

			it('should create and validate SessionAuthenticate', () => {
				const result = KNXProtocol.newSessionAuthenticate(
					1,
					mockClientPublicKey,
					mockServerPublicKey,
					mockPasswordHash,
					mockSerialNumber,
				)
				assert(
					result.verifyMAC(
						mockPasswordHash,
						mockClientPublicKey,
						mockServerPublicKey,
						mockSerialNumber,
					),
				)
			})

			it('should fail MAC verification with wrong session key', () => {
				const wrongKey = Buffer.alloc(16, 0xff)
				const wrapper = KNXProtocol.newSecureConnectRequest(
					mockTunnelCRI,
					1,
					1,
					mockSerialNumber,
					0,
					mockSessionKey,
				)
				assert.throws(() => SecureWrapper.unwrap(wrapper, wrongKey))
			})
		})
	})
})
