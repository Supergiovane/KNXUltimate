import { describe, it } from 'node:test'
import assert from 'node:assert'
import KNXConnectionStateRequest from '../../src/protocol/KNXConnectionStateRequest'
import HPAI from '../../src/protocol/HPAI'
import { KNX_CONSTANTS } from '../../src/protocol/KNXConstants'

describe('KNXConnectionStateRequest', () => {
	it('should create a KNXConnectionStateRequest with channelID and HPAI', () => {
		const hpai = new HPAI('192.168.1.1', 3671, KNX_CONSTANTS.IPV4_UDP)
		const request = new KNXConnectionStateRequest(1, hpai)

		assert.strictEqual(request.channelID, 1)
		assert.strictEqual(request.hpaiControl, hpai)
	})

	it('should create a KNXConnectionStateRequest with default HPAI', () => {
		const request = new KNXConnectionStateRequest(1)
		assert.strictEqual(request.channelID, 1)
		assert.deepStrictEqual(request.hpaiControl, HPAI.NULLHPAI)
	})

	it('should create a KNXConnectionStateRequest from buffer', () => {
		const hpai = new HPAI('192.168.1.1', 3671, KNX_CONSTANTS.IPV4_UDP)
		const buffer = Buffer.alloc(10)
		buffer.writeUInt8(1, 0)
		buffer.writeUInt8(0, 1)
		hpai.toBuffer().copy(buffer, 2)

		const request = KNXConnectionStateRequest.createFromBuffer(buffer)
		assert.strictEqual(request.channelID, 1)
		assert.deepStrictEqual(request.hpaiControl, hpai)
	})

	it('should throw an error if buffer is too short', () => {
		const buffer = Buffer.alloc(1) // too small
		assert.throws(() => {
			KNXConnectionStateRequest.createFromBuffer(buffer)
		}, /offset 2 out of buffer range 1/)
	})

	it('should handle buffer with exact required length', () => {
		const buffer = Buffer.alloc(10)
		buffer.writeUInt8(1, 0) // channelID
		buffer.writeUInt8(0, 1) // reserved
		const hpai = new HPAI('192.168.1.1', 3671, KNX_CONSTANTS.IPV4_UDP)
		hpai.toBuffer().copy(buffer, 2)

		const request = KNXConnectionStateRequest.createFromBuffer(buffer)
		assert.strictEqual(request.channelID, 1)
		assert.deepStrictEqual(request.hpaiControl, hpai)
	})

	it('should convert KNXConnectionStateRequest to buffer', () => {
		const hpai = new HPAI('192.168.1.1', 3671, KNX_CONSTANTS.IPV4_UDP)
		const request = new KNXConnectionStateRequest(1, hpai)

		const resultBuffer = request.toBuffer()
		const expectedBuffer = Buffer.alloc(16)
		expectedBuffer.writeUInt8(6, 0) // Header length
		expectedBuffer.writeUInt8(16, 1) // Protocol version
		expectedBuffer.writeUInt16BE(KNX_CONSTANTS.CONNECTIONSTATE_REQUEST, 2) // Service type
		expectedBuffer.writeUInt16BE(16, 4) // Total length
		expectedBuffer.writeUInt8(1, 6) // channelID
		expectedBuffer.writeUInt8(0, 7) // reserved
		hpai.toBuffer().copy(expectedBuffer, 8)

		assert.deepStrictEqual(resultBuffer, expectedBuffer)
	})

	it('should handle edge case channelID values', () => {
		const request1 = new KNXConnectionStateRequest(0)
		assert.strictEqual(request1.channelID, 0)

		const request2 = new KNXConnectionStateRequest(255)
		assert.strictEqual(request2.channelID, 255)
	})
})
