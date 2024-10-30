import { describe, it } from 'node:test'
import assert from 'assert'
import KNXConnectResponse from '../../src/protocol/KNXConnectResponse'
import HPAI from '../../src/protocol/HPAI'
import CRD, { ConnectionType } from '../../src/protocol/CRD'
import KNXAddress from '../../src/protocol/KNXAddress'
import { KNX_CONSTANTS } from '../../src/protocol/KNXConstants'

describe('KNXConnectResponse', () => {
	it('should create a KNXConnectResponse with channelID, status, HPAI, and CRD', () => {
		const hpai = new HPAI('192.168.1.1', 3671, KNX_CONSTANTS.IPV4_UDP)
		const knxAddress = new KNXAddress(0x1234)
		const crd = new CRD(ConnectionType.TUNNEL_CONNECTION, knxAddress)
		const response = new KNXConnectResponse(
			1,
			KNX_CONSTANTS.E_CONNECTION_ID,
			hpai,
			crd,
		)

		assert.strictEqual(response.channelID, 1)
		assert.strictEqual(response.status, KNX_CONSTANTS.E_CONNECTION_ID)
		assert.strictEqual(response.hpai, hpai)
		assert.strictEqual(response.crd, crd)
	})

	it('should create a KNXConnectResponse from buffer', () => {
		const buffer = Buffer.alloc(20)
		buffer.writeUInt8(1, 0) // channelID
		buffer.writeUInt8(KNX_CONSTANTS.E_CONNECTION_ID, 1) // status
		const hpai = new HPAI('192.168.1.1', 3671, KNX_CONSTANTS.IPV4_UDP)
		const knxAddress = new KNXAddress(0x1234)
		const crd = new CRD(ConnectionType.TUNNEL_CONNECTION, knxAddress)
		hpai.toBuffer().copy(buffer, 2) // Write HPAI to buffer
		crd.toBuffer().copy(buffer, 10) // Write CRD to buffer

		const response = KNXConnectResponse.createFromBuffer(buffer)
		assert.strictEqual(response.channelID, 1)
		assert.strictEqual(response.status, KNX_CONSTANTS.E_CONNECTION_ID)
		assert.deepStrictEqual(response.hpai.toBuffer(), hpai.toBuffer())
		assert.deepStrictEqual(response.crd.toBuffer(), crd.toBuffer())
	})

	it('should throw an error if buffer is too short', () => {
		const buffer = Buffer.alloc(1) // buffer too small
		assert.throws(() => {
			KNXConnectResponse.createFromBuffer(buffer)
		}, /Buffer too short/)
	})

	it('should convert KNXConnectResponse to buffer', () => {
		const hpai = new HPAI('192.168.1.1', 3671, KNX_CONSTANTS.IPV4_UDP)
		const knxAddress = new KNXAddress(0x1234)
		const crd = new CRD(ConnectionType.TUNNEL_CONNECTION, knxAddress)
		const response = new KNXConnectResponse(
			1,
			KNX_CONSTANTS.E_CONNECTION_ID,
			hpai,
			crd,
		)

		const resultBuffer = response.toBuffer()
		const expectedBuffer = Buffer.concat([
			Buffer.from([1, KNX_CONSTANTS.E_CONNECTION_ID]),
			hpai.toBuffer(),
			crd.toBuffer(),
		])

		assert.deepStrictEqual(resultBuffer, expectedBuffer)
	})
})
