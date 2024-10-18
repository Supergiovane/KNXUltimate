import { describe, it } from 'node:test'
import assert from 'assert'
import HPAI, { KnxProtocol } from '../../src/protocol/HPAI'
import { KNX_CONSTANTS } from '../../src/protocol/KNXConstants'

describe('HPAI', () => {
	it('should correctly create HPAI with default values', () => {
		const hpai = new HPAI('192.168.1.1')

		assert.strictEqual(hpai.host, '192.168.1.1')
		assert.strictEqual(hpai.port, KNX_CONSTANTS.KNX_PORT)
		assert.strictEqual(hpai.protocol, KnxProtocol.IPV4_UDP)
		assert.strictEqual(hpai.length, 8)
	})

	it('should throw an error for an invalid host format', () => {
		assert.throws(() => {
			const _ = new HPAI('invalid_ip')
		}, /Invalid host format/)
	})

	it('should set and validate port number', () => {
		const hpai = new HPAI('192.168.1.1')
		hpai.port = 5000
		assert.strictEqual(hpai.port, 5000)

		assert.throws(() => {
			hpai.port = -1 // Invalid port
		}, /Invalid port/)
	})

	it('should allow changing the protocol', () => {
		const hpai = new HPAI('192.168.1.1')
		hpai.protocol = KnxProtocol.IPV4_TCP
		assert.strictEqual(hpai.protocol, KnxProtocol.IPV4_TCP)
	})

	it('should create HPAI from buffer', () => {
		const buffer = Buffer.alloc(8)
		buffer.writeUInt8(8, 0)
		buffer.writeUInt8(KNX_CONSTANTS.IPV4_UDP, 1)
		buffer.writeUInt8(192, 2)
		buffer.writeUInt8(168, 3)
		buffer.writeUInt8(1, 4)
		buffer.writeUInt8(1, 5)
		buffer.writeUInt16BE(3671, 6)

		const hpai = HPAI.createFromBuffer(buffer)
		assert.strictEqual(hpai.host, '192.168.1.1')
		assert.strictEqual(hpai.port, 3671)
		assert.strictEqual(hpai.protocol, KnxProtocol.IPV4_UDP)
	})

	it('should throw an error for buffer out of range', () => {
		const buffer = Buffer.alloc(7) // One byte less than required
		assert.throws(
			() => {
				HPAI.createFromBuffer(buffer)
			},
			(error: Error) => {
				return (
					error instanceof RangeError ||
					/offset \d+ block length: \d+ out of buffer range \d+/.test(
						error.message,
					)
				)
			},
			'Expected either a RangeError or a specific error message format',
		)
	})

	it('should convert HPAI to buffer', () => {
		const hpai = new HPAI('192.168.1.1', 3671, KnxProtocol.IPV4_UDP)
		const buffer = hpai.toBuffer()

		assert.strictEqual(buffer.readUInt8(0), 8) // structureLength
		assert.strictEqual(buffer.readUInt8(1), KnxProtocol.IPV4_UDP) // protocol
		assert.strictEqual(buffer.readUInt8(2), 192) // IP octets
		assert.strictEqual(buffer.readUInt8(3), 168)
		assert.strictEqual(buffer.readUInt8(4), 1)
		assert.strictEqual(buffer.readUInt8(5), 1)
		assert.strictEqual(buffer.readUInt16BE(6), 3671) // port
	})

	it('should create correct NULLHPAI', () => {
		const nullHpai = HPAI.NULLHPAI
		assert.strictEqual(nullHpai.host, '0.0.0.0')
		assert.strictEqual(nullHpai.port, 0)
	})

	it('should throw an error when setting null host', () => {
		const hpai = new HPAI('192.168.1.1')
		assert.throws(() => {
			;(hpai as any).host = null
		}, /Host undefined/)
	})

	it('should handle limit values for port', () => {
		const hpai = new HPAI('192.168.1.1')
		hpai.port = 0
		assert.strictEqual(hpai.port, 0)
		hpai.port = 65535
		assert.strictEqual(hpai.port, 65535)
		assert.throws(() => {
			hpai.port = 65536
		}, /Invalid port/)
	})

	it('should return undefined for header getter', () => {
		const hpai = new HPAI('192.168.1.1')
		assert.strictEqual(hpai.header, undefined)
	})
})
