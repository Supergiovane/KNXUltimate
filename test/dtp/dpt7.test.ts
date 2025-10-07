/**
 * Validates KNX Data Point Type 7 conversions.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT7 from '../../src/dptlib/dpt7'

describe('DPT7 (16-bit unsigned value)', () => {
	describe('formatAPDU', () => {
		test('should correctly format values within range', () => {
			// Test minimum value (0)
			assert.deepEqual(DPT7.formatAPDU(0), Buffer.from([0x00, 0x00]))

			// Test maximum value (65535)
			assert.deepEqual(DPT7.formatAPDU(65535), Buffer.from([0xff, 0xff]))

			// Test mid-range values
			assert.deepEqual(DPT7.formatAPDU(1000), Buffer.from([0x03, 0xe8]))

			assert.deepEqual(DPT7.formatAPDU(40000), Buffer.from([0x9c, 0x40]))
		})

		test('should handle out of range values', () => {
			// Test negative values (should be clamped to 0)
			assert.deepEqual(DPT7.formatAPDU(-1), Buffer.from([0x00, 0x00]))

			assert.deepEqual(DPT7.formatAPDU(-1000), Buffer.from([0x00, 0x00]))

			// Test values above maximum (should be clamped to 65535)
			assert.deepEqual(DPT7.formatAPDU(65536), Buffer.from([0xff, 0xff]))

			assert.deepEqual(DPT7.formatAPDU(100000), Buffer.from([0xff, 0xff]))
		})

		test('should handle invalid inputs', () => {
			// Test undefined
			assert.deepEqual(
				DPT7.formatAPDU(undefined),
				Buffer.from([0x00, 0x00]),
			)

			// Test null
			assert.deepEqual(DPT7.formatAPDU(null), Buffer.from([0x00, 0x00]))

			// Test NaN
			assert.deepEqual(DPT7.formatAPDU(NaN), Buffer.from([0x00, 0x00]))

			// Test non-numeric values
			assert.deepEqual(DPT7.formatAPDU({}), Buffer.from([0x00, 0x00]))

			assert.deepEqual(DPT7.formatAPDU([]), Buffer.from([0x00, 0x00]))

			assert.deepEqual(DPT7.formatAPDU('abc'), Buffer.from([0x00, 0x00]))
		})

		test('should handle numeric strings', () => {
			// Test valid numeric strings
			assert.deepEqual(DPT7.formatAPDU('1000'), Buffer.from([0x03, 0xe8]))

			assert.deepEqual(
				DPT7.formatAPDU('65535'),
				Buffer.from([0xff, 0xff]),
			)

			// Test numeric strings out of range
			assert.deepEqual(DPT7.formatAPDU('-1'), Buffer.from([0x00, 0x00]))

			assert.deepEqual(
				DPT7.formatAPDU('65536'),
				Buffer.from([0xff, 0xff]),
			)
		})
	})

	describe('fromBuffer', () => {
		test('should correctly parse valid buffers', () => {
			// Test minimum value
			assert.equal(DPT7.fromBuffer(Buffer.from([0x00, 0x00])), 0)

			// Test maximum value
			assert.equal(DPT7.fromBuffer(Buffer.from([0xff, 0xff])), 65535)

			// Test mid-range values
			assert.equal(DPT7.fromBuffer(Buffer.from([0x03, 0xe8])), 1000)

			assert.equal(DPT7.fromBuffer(Buffer.from([0x9c, 0x40])), 40000)
		})

		test('should handle invalid buffer lengths', () => {
			// Test empty buffer
			assert.strictEqual(DPT7.fromBuffer(Buffer.from([])), null)

			// Test single byte buffer
			assert.strictEqual(DPT7.fromBuffer(Buffer.from([0xff])), null)

			// Test buffer too long
			assert.strictEqual(
				DPT7.fromBuffer(Buffer.from([0x00, 0x00, 0x00])),
				null,
			)
		})

		test('should correctly calculate values from high and low bytes', () => {
			// Test various byte combinations
			assert.equal(
				DPT7.fromBuffer(Buffer.from([0x01, 0x00])),
				256, // 1 * 256 + 0
			)

			assert.equal(
				DPT7.fromBuffer(Buffer.from([0x00, 0x01])),
				1, // 0 * 256 + 1
			)

			assert.equal(
				DPT7.fromBuffer(Buffer.from([0x01, 0x01])),
				257, // 1 * 256 + 1
			)

			assert.equal(
				DPT7.fromBuffer(Buffer.from([0xff, 0x00])),
				65280, // 255 * 256 + 0
			)
		})
	})
})
