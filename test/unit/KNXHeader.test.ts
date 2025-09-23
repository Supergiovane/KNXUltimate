/**
 * Unit tests for KNX Header.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, it } from 'node:test'
import assert from 'assert'
import KNXHeader from '../../src/protocol/KNXHeader'
import { KNX_CONSTANTS } from '../../src/protocol/KNXConstants'

describe('KNXHeader', () => {
	describe('Constructor', () => {
		it('should create a KNXHeader with correct service type and length', () => {
			const type = KNX_CONSTANTS.SEARCH_REQUEST
			const length = 10
			const header = new KNXHeader(type, length)

			assert.strictEqual(header.service_type, type)
			assert.strictEqual(
				header.length,
				KNX_CONSTANTS.HEADER_SIZE_10 + length,
			)
			assert.strictEqual(
				header.headerLength,
				KNX_CONSTANTS.HEADER_SIZE_10,
			)
			assert.strictEqual(
				header.version,
				KNX_CONSTANTS.KNXNETIP_VERSION_10,
			)
		})
	})

	describe('createFromBuffer', () => {
		it('should create a KNXHeader from a valid buffer', () => {
			const buffer = Buffer.alloc(KNX_CONSTANTS.HEADER_SIZE_10)
			buffer.writeUInt8(KNX_CONSTANTS.HEADER_SIZE_10, 0)
			buffer.writeUInt8(KNX_CONSTANTS.KNXNETIP_VERSION_10, 1)
			buffer.writeUInt16BE(KNX_CONSTANTS.SEARCH_REQUEST, 2)
			buffer.writeUInt16BE(KNX_CONSTANTS.HEADER_SIZE_10 + 10, 4)

			const header = KNXHeader.createFromBuffer(buffer)
			assert.strictEqual(
				header.headerLength,
				KNX_CONSTANTS.HEADER_SIZE_10,
			)
			assert.strictEqual(
				header.version,
				KNX_CONSTANTS.KNXNETIP_VERSION_10,
			)
			assert.strictEqual(
				header.service_type,
				KNX_CONSTANTS.SEARCH_REQUEST,
			)
			assert.strictEqual(header.length, KNX_CONSTANTS.HEADER_SIZE_10 + 10)
		})

		it('should throw an error if the buffer is too short', () => {
			const buffer = Buffer.alloc(KNX_CONSTANTS.HEADER_SIZE_10 - 1)
			assert.throws(() => {
				KNXHeader.createFromBuffer(buffer)
			}, /Incomplete buffer/)
		})

		it('should throw an error if header length is invalid', () => {
			const buffer = Buffer.alloc(KNX_CONSTANTS.HEADER_SIZE_10)
			buffer.writeUInt8(KNX_CONSTANTS.HEADER_SIZE_10 - 1, 0) // Invalid header length
			assert.throws(() => {
				KNXHeader.createFromBuffer(buffer)
			}, /Invalid buffer length/)
		})

		it('should throw an error if version is invalid', () => {
			const buffer = Buffer.alloc(KNX_CONSTANTS.HEADER_SIZE_10)
			buffer.writeUInt8(KNX_CONSTANTS.HEADER_SIZE_10, 0)
			buffer.writeUInt8(KNX_CONSTANTS.KNXNETIP_VERSION_10 + 1, 1) // Invalid version
			assert.throws(() => {
				KNXHeader.createFromBuffer(buffer)
			}, /Unknown version/)
		})

		it('should log an error if buffer length does not match the length field', () => {
			const buffer = Buffer.alloc(KNX_CONSTANTS.HEADER_SIZE_10 + 2)
			buffer.writeUInt8(KNX_CONSTANTS.HEADER_SIZE_10, 0)
			buffer.writeUInt8(KNX_CONSTANTS.KNXNETIP_VERSION_10, 1)
			buffer.writeUInt16BE(KNX_CONSTANTS.SEARCH_REQUEST, 2)
			buffer.writeUInt16BE(KNX_CONSTANTS.HEADER_SIZE_10 + 10, 4) // Mismatch with actual buffer length

			// We expect this to log an error, but not throw
			const header = KNXHeader.createFromBuffer(buffer)
			assert(header instanceof KNXHeader)
		})
	})

	describe('toBuffer', () => {
		it('should convert KNXHeader to buffer correctly', () => {
			const type = KNX_CONSTANTS.SEARCH_REQUEST
			const length = 10
			const header = new KNXHeader(type, length)

			const resultBuffer = header.toBuffer()
			assert.strictEqual(
				resultBuffer.readUInt8(0),
				KNX_CONSTANTS.HEADER_SIZE_10,
			)
			assert.strictEqual(
				resultBuffer.readUInt8(1),
				KNX_CONSTANTS.KNXNETIP_VERSION_10,
			)
			assert.strictEqual(
				resultBuffer.readUInt16BE(2),
				KNX_CONSTANTS.SEARCH_REQUEST,
			)
			assert.strictEqual(
				resultBuffer.readUInt16BE(4),
				KNX_CONSTANTS.HEADER_SIZE_10 + 10,
			)
		})
	})

	describe('Getters', () => {
		it('should return correct values for headerLength and version', () => {
			const header = new KNXHeader(KNX_CONSTANTS.SEARCH_REQUEST, 10)
			assert.strictEqual(
				header.headerLength,
				KNX_CONSTANTS.HEADER_SIZE_10,
			)
			assert.strictEqual(
				header.version,
				KNX_CONSTANTS.KNXNETIP_VERSION_10,
			)
		})
	})
})
