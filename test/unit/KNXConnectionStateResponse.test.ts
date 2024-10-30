import { describe, it } from 'node:test'
import assert from 'assert'
import KNXConnectionStateResponse from '../../src/protocol/KNXConnectionStateResponse'
import { KNX_CONSTANTS } from '../../src/protocol/KNXConstants'

describe('KNXConnectionStateResponse', () => {
	it('should create a KNXConnectionStateResponse with channelID and status', () => {
		const response = new KNXConnectionStateResponse(
			1,
			KNX_CONSTANTS.E_CONNECTION_ID,
		)

		assert.strictEqual(response.channelID, 1)
		assert.strictEqual(response.status, KNX_CONSTANTS.E_CONNECTION_ID)
	})

	it('should create a KNXConnectionStateResponse from buffer', () => {
		const buffer = Buffer.alloc(2)
		buffer.writeUInt8(1, 0) // channelID
		buffer.writeUInt8(KNX_CONSTANTS.E_CONNECTION_ID, 1) // status

		const response = KNXConnectionStateResponse.createFromBuffer(buffer)
		assert.strictEqual(response.channelID, 1)
		assert.strictEqual(response.status, KNX_CONSTANTS.E_CONNECTION_ID)
	})

	it('should throw an error if buffer is too short', () => {
		const buffer = Buffer.alloc(0)
		assert.throws(() => {
			KNXConnectionStateResponse.createFromBuffer(buffer)
		}, /Buffer too short/)
	})

	it('should convert KNXConnectionStateResponse to buffer', () => {
		const response = new KNXConnectionStateResponse(
			1,
			KNX_CONSTANTS.E_CONNECTION_ID,
		)
		const resultBuffer = response.toBuffer()

		const expectedBuffer = Buffer.alloc(2)
		expectedBuffer.writeUInt8(1, 0) // channelID
		expectedBuffer.writeUInt8(KNX_CONSTANTS.E_CONNECTION_ID, 1) // status

		assert.deepStrictEqual(resultBuffer.subarray(-2), expectedBuffer)
	})

	it('should return correct error message for status code', () => {
		const statusString = KNXConnectionStateResponse.statusToString(
			KNX_CONSTANTS.E_CONNECTION_ID,
		)
		assert.strictEqual(statusString, 'Invalid Connection ID')
	})
})
