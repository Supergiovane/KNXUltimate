/**
 * Validates KNX Data Point Type 999 conversions.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT999 from '../../src/dptlib/dpt999'

describe('DPT999 (10-bytes HEX string)', () => {
	describe('formatAPDU', () => {
		test('should correctly format valid HEX strings', () => {
			// Standard 20-character hex string
			assert.deepEqual(
				DPT999.formatAPDU('1234567890AABBCCDDEE'),
				Buffer.from([
					0x12, 0x34, 0x56, 0x78, 0x90, 0xaa, 0xbb, 0xcc, 0xdd, 0xee,
				]),
			)

			// String with zeros
			assert.deepEqual(
				DPT999.formatAPDU('12340000000000000000'),
				Buffer.from([
					0x12, 0x34, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
				]),
			)
		})

		test('should handle strings with special prefixes and spaces', () => {
			// String with $ prefixes
			assert.deepEqual(
				DPT999.formatAPDU('$12$34$56$78$90$AA$BB$CC$DD$EE'),
				Buffer.from([
					0x12, 0x34, 0x56, 0x78, 0x90, 0xaa, 0xbb, 0xcc, 0xdd, 0xee,
				]),
			)

			// String with 0x prefixes
			assert.deepEqual(
				DPT999.formatAPDU('0x120x340x560x780x900xAA0xBB0xCC0xDD0xEE'),
				Buffer.from([
					0x12, 0x34, 0x56, 0x78, 0x90, 0xaa, 0xbb, 0xcc, 0xdd, 0xee,
				]),
			)

			// String with spaces
			assert.deepEqual(
				DPT999.formatAPDU('12 34 56 78 90 AA BB CC DD EE'),
				Buffer.from([
					0x12, 0x34, 0x56, 0x78, 0x90, 0xaa, 0xbb, 0xcc, 0xdd, 0xee,
				]),
			)

			// Mixed format string
			assert.deepEqual(
				DPT999.formatAPDU('$12 0x34 56 $78 90 0xAA BB $CC DD 0xEE'),
				Buffer.from([
					0x12, 0x34, 0x56, 0x78, 0x90, 0xaa, 0xbb, 0xcc, 0xdd, 0xee,
				]),
			)
		})

		test('should handle lowercase input', () => {
			assert.deepEqual(
				DPT999.formatAPDU('1234567890aabbccddee'),
				Buffer.from([
					0x12, 0x34, 0x56, 0x78, 0x90, 0xaa, 0xbb, 0xcc, 0xdd, 0xee,
				]),
			)
		})

		test('should handle invalid inputs', () => {
			// String too short
			assert.strictEqual(DPT999.formatAPDU('123456'), null)

			// Non-string input
			assert.strictEqual(DPT999.formatAPDU(12345 as any), null)

			// Null or undefined
			assert.strictEqual(DPT999.formatAPDU(null as any), null)
			assert.strictEqual(DPT999.formatAPDU(undefined as any), null)
		})
	})

	describe('fromBuffer', () => {
		test('should correctly convert buffer to hex string', () => {
			// Standard buffer
			assert.equal(
				DPT999.fromBuffer(
					Buffer.from([
						0x12, 0x34, 0x56, 0x78, 0x90, 0xaa, 0xbb, 0xcc, 0xdd,
						0xee,
					]),
				),
				'1234567890aabbccddee',
			)

			// Buffer with zeros
			assert.equal(
				DPT999.fromBuffer(
					Buffer.from([
						0x12, 0x34, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
						0x00,
					]),
				),
				'12340000000000000000',
			)

			// Buffer with all zeros
			assert.equal(
				DPT999.fromBuffer(
					Buffer.from([
						0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
						0x00,
					]),
				),
				'00000000000000000000',
			)

			// Buffer with all FFs
			assert.equal(
				DPT999.fromBuffer(
					Buffer.from([
						0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
						0xff,
					]),
				),
				'ffffffffffffffffffff', // Corretto per 10 bytes (20 caratteri)
			)
		})

		test('should handle non-standard buffer lengths', () => {
			// Testing with different buffer lengths to ensure robustness
			assert.equal(DPT999.fromBuffer(Buffer.from([0x12, 0x34])), '1234')

			assert.equal(
				DPT999.fromBuffer(Buffer.from([0x12, 0x34, 0x56, 0x78, 0x90])),
				'1234567890',
			)
		})
	})
})
