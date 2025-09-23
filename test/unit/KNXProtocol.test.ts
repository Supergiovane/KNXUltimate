/**
 * Unit tests for KNX Protocol.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, it, beforeEach } from 'node:test'
import assert from 'assert'
import KNXProtocol from '../../src/protocol/KNXProtocol'
import KNXHeader from '../../src/protocol/KNXHeader'
import HPAI from '../../src/protocol/HPAI'
import TunnelCRI from '../../src/protocol/TunnelCRI'
import CEMIMessage from '../../src/protocol/cEMI/CEMIMessage'
import { KNX_CONSTANTS } from '../../src/protocol/KNXConstants'

import KNXSearchRequest from '../../src/protocol/KNXSearchRequest'
import KNXDescriptionRequest from '../../src/protocol/KNXDescriptionRequest'
import KNXConnectRequest from '../../src/protocol/KNXConnectRequest'
import KNXConnectionStateRequest from '../../src/protocol/KNXConnectionStateRequest'
import KNXDisconnectRequest from '../../src/protocol/KNXDisconnectRequest'
import KNXDisconnectResponse from '../../src/protocol/KNXDisconnectResponse'
import KNXTunnelingAck from '../../src/protocol/KNXTunnelingAck'
import KNXTunnelingRequest from '../../src/protocol/KNXTunnelingRequest'
import KNXRoutingIndication from '../../src/protocol/KNXRoutingIndication'

describe('KNXProtocol', () => {
	let mockHPAI: HPAI
	let mockTunnelCRI: TunnelCRI
	let mockCEMIMessage: CEMIMessage

	beforeEach(() => {
		mockHPAI = new HPAI('192.168.1.1', 3671, KNX_CONSTANTS.IPV4_UDP)
		mockTunnelCRI = new TunnelCRI(KNX_CONSTANTS.TUNNEL_LINKLAYER)
		mockCEMIMessage = {} as CEMIMessage
	})

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
			const mockBuffer = Buffer.from([0x06, 0x10, 0xff, 0xff, 0x00, 0x0e])
			const result = KNXProtocol.parseMessage(mockBuffer)
			assert(result.knxHeader instanceof KNXHeader)
			assert(result.knxMessage === undefined)
		})
	})

	describe('newKNXSearchRequest', () => {
		it('should create a new KNXSearchRequest', () => {
			const result = KNXProtocol.newKNXSearchRequest(mockHPAI)
			assert(result instanceof KNXSearchRequest)
			assert.deepStrictEqual(result.hpai, mockHPAI)
		})
	})

	describe('newKNXDescriptionRequest', () => {
		it('should create a new KNXDescriptionRequest', () => {
			const result = KNXProtocol.newKNXDescriptionRequest(mockHPAI)
			assert(result instanceof KNXDescriptionRequest)
			assert.deepStrictEqual(result.hpai, mockHPAI)
		})
	})

	describe('newKNXConnectRequest', () => {
		it('should create a new KNXConnectRequest with default HPAIs', () => {
			const result = KNXProtocol.newKNXConnectRequest(mockTunnelCRI)
			assert(result instanceof KNXConnectRequest)
			assert.deepStrictEqual(result.cri, mockTunnelCRI)
			assert.deepStrictEqual(result.hpaiControl, HPAI.NULLHPAI)
			assert.deepStrictEqual(result.hpaiData, HPAI.NULLHPAI)
		})

		it('should create a new KNXConnectRequest with custom HPAIs', () => {
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
	})

	describe('newKNXConnectionStateRequest', () => {
		it('should create a new KNXConnectionStateRequest with default HPAI', () => {
			const result = KNXProtocol.newKNXConnectionStateRequest(1)
			assert(result instanceof KNXConnectionStateRequest)
			assert.strictEqual(result.channelID, 1)
			assert.deepStrictEqual(result.hpaiControl, HPAI.NULLHPAI)
		})

		it('should create a new KNXConnectionStateRequest with custom HPAI', () => {
			const result = KNXProtocol.newKNXConnectionStateRequest(1, mockHPAI)
			assert(result instanceof KNXConnectionStateRequest)
			assert.strictEqual(result.channelID, 1)
			assert.deepStrictEqual(result.hpaiControl, mockHPAI)
		})
	})

	describe('newKNXDisconnectRequest', () => {
		it('should create a new KNXDisconnectRequest with default HPAI', () => {
			const result = KNXProtocol.newKNXDisconnectRequest(1)
			assert(result instanceof KNXDisconnectRequest)
			assert.strictEqual(result.channelID, 1)
			assert.deepStrictEqual(result.hpaiControl, HPAI.NULLHPAI)
		})

		it('should create a new KNXDisconnectRequest with custom HPAI', () => {
			const result = KNXProtocol.newKNXDisconnectRequest(1, mockHPAI)
			assert(result instanceof KNXDisconnectRequest)
			assert.strictEqual(result.channelID, 1)
			assert.deepStrictEqual(result.hpaiControl, mockHPAI)
		})
	})

	describe('newKNXDisconnectResponse', () => {
		it('should create a new KNXDisconnectResponse', () => {
			const result = KNXProtocol.newKNXDisconnectResponse(1, 0)
			assert(result instanceof KNXDisconnectResponse)
			assert.strictEqual(result.channelID, 1)
			assert.strictEqual(result.status, 0)
		})
	})

	describe('newKNXTunnelingACK', () => {
		it('should create a new KNXTunnelingACK', () => {
			const result = KNXProtocol.newKNXTunnelingACK(1, 2, 0)
			assert(result instanceof KNXTunnelingAck)
			assert.strictEqual(result.channelID, 1)
			assert.strictEqual(result.seqCounter, 2)
			assert.strictEqual(result.status, 0)
		})
	})

	describe('newKNXTunnelingRequest', () => {
		it('should create a new KNXTunnelingRequest', () => {
			const result = KNXProtocol.newKNXTunnelingRequest(
				1,
				2,
				mockCEMIMessage,
			)
			assert(result instanceof KNXTunnelingRequest)
			assert.strictEqual(result.channelID, 1)
			assert.strictEqual(result.seqCounter, 2)
			assert.deepStrictEqual(result.cEMIMessage, mockCEMIMessage)
		})
	})

	describe('newKNXRoutingIndication', () => {
		it('should create a new KNXRoutingIndication', () => {
			const result = KNXProtocol.newKNXRoutingIndication(mockCEMIMessage)
			assert(result instanceof KNXRoutingIndication)
			assert.deepStrictEqual(result.cEMIMessage, mockCEMIMessage)
		})
	})
})
