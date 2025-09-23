/**
 * Unit tests for KNX Addresses.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, it } from 'node:test'
import assert from 'assert'
import KNXAddresses from '../../src/protocol/KNXAddresses'
import { KNX_CONSTANTS } from '../../src/protocol/KNXConstants'

describe('KNXAddresses', () => {
	it('should throw an error if buffer is too small', () => {
		const buffer = Buffer.alloc(1) // Buffer of only one byte

		assert.throws(
			() => {
				KNXAddresses.createFromBuffer(buffer)
			},
			(err) => {
				return (
					err instanceof Error &&
					(err.message.includes('out of buffer range') ||
						err.message.includes('out of range'))
				)
			},
		)
	})

	it('should correctly add KNX addresses', () => {
		const addresses = new KNXAddresses()
		addresses.add('1.1.1')
		addresses.add('1.1.2')

		assert.strictEqual(addresses.length, 6)
		assert.strictEqual(addresses.getAddressCount(), 2)

		const buffer = addresses.toBuffer()
		assert.strictEqual(buffer.readUInt16BE(2), 0x1101)
		assert.strictEqual(buffer.readUInt16BE(4), 0x1102)
	})

	it('should convert KNXAddresses to buffer', () => {
		const addresses = new KNXAddresses()
		addresses.add('1.1.1')
		addresses.add('1.1.2')

		const buffer = addresses.toBuffer()
		assert.strictEqual(buffer.readUInt8(0), addresses.length)
		assert.strictEqual(buffer.readUInt8(1), KNX_CONSTANTS.KNX_ADDRESSES)
		assert.strictEqual(buffer.readUInt16BE(2), 0x1101)
		assert.strictEqual(buffer.readUInt16BE(4), 0x1102)
	})

	it('should throw an error for invalid address format', () => {
		const addresses = new KNXAddresses()

		assert.throws(
			() => {
				addresses.add('1.1.256') // Invalid device address
			},
			(err) => {
				return (
					err instanceof Error &&
					err.message.includes(
						'Invalid Individual Address digit 256 inside address: 1.1.256',
					)
				)
			},
		)
	})

	it('should handle empty KNXAddresses', () => {
		const addresses = new KNXAddresses()

		assert.strictEqual(addresses.getAddressCount(), 0)
		assert.strictEqual(addresses.length, 2)

		const buffer = addresses.toBuffer()
		assert.strictEqual(buffer.length, 2)
		assert.strictEqual(buffer.readUInt8(0), 2)
		assert.strictEqual(buffer.readUInt8(1), KNX_CONSTANTS.KNX_ADDRESSES)
	})
})
