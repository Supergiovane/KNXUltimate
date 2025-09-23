/**
 * Unit tests for KNX Packet.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, it } from 'node:test'
import assert from 'assert'
import KNXPacket from '../../src/protocol/KNXPacket'
import KNXHeader from '../../src/protocol/KNXHeader'

describe('KNXPacket', () => {
	it('should create a KNXPacket with correct type and length', () => {
		const type = 0x0201 // Example type (SEARCH_REQUEST)
		const length = 10
		const packet = new KNXPacket(type, length)

		assert.strictEqual(packet.type, type)
		assert.strictEqual(packet.length, length)
		assert(packet.header instanceof KNXHeader)
	})

	it('should return the correct header', () => {
		const type = 0x0201 // Example type (SEARCH_REQUEST)
		const length = 10
		const packet = new KNXPacket(type, length)

		assert(packet.header instanceof KNXHeader)
		assert.strictEqual(packet.header.service_type, type)
		assert.strictEqual(packet.header.length, length + 6) // Assuming 6 bytes for the header length
	})

	it('should return an empty buffer from toBuffer method (placeholder implementation)', () => {
		const type = 0x0201 // Example type (SEARCH_REQUEST)
		const length = 10
		const packet = new KNXPacket(type, length)
		const buffer = packet.toBuffer()

		assert(Buffer.isBuffer(buffer), 'toBuffer should return a Buffer')
		assert.strictEqual(
			buffer.length,
			0,
			'Buffer should be empty (placeholder implementation)',
		)
	})

	it('should handle different types and lengths correctly', () => {
		const testCases = [
			{ type: 0x0201, length: 10 }, // SEARCH_REQUEST
			{ type: 0x0202, length: 20 }, // SEARCH_RESPONSE
			{ type: 0x0203, length: 0 }, // DESCRIPTION_REQUEST
			{ type: 0x0204, length: 50 }, // DESCRIPTION_RESPONSE
		]

		testCases.forEach(({ type, length }) => {
			const packet = new KNXPacket(type, length)
			assert.strictEqual(packet.type, type)
			assert.strictEqual(packet.length, length)
			assert.strictEqual(packet.header.service_type, type)
			assert.strictEqual(packet.header.length, length + 6)
		})
	})
})
