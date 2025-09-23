/**
 * Validates KNX Data Point Type 20 conversions.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT20 from '../../src/dptlib/dpt20'

describe('DPT20 (1-byte HVAC)', () => {
	describe('formatAPDU', () => {
		test('should format numbers to single-byte buffer', () => {
			// Test common HVAC mode values
			assert.deepEqual(DPT20.formatAPDU(0), Buffer.from([0])) // Auto
			assert.deepEqual(DPT20.formatAPDU(1), Buffer.from([1])) // Comfort
			assert.deepEqual(DPT20.formatAPDU(2), Buffer.from([2])) // Standby
			assert.deepEqual(DPT20.formatAPDU(3), Buffer.from([3])) // Economy
			assert.deepEqual(DPT20.formatAPDU(4), Buffer.from([4])) // Building Protection
		})

		test('should handle edge case values', () => {
			// Test byte range limits
			assert.deepEqual(DPT20.formatAPDU(0), Buffer.from([0]))
			assert.deepEqual(DPT20.formatAPDU(255), Buffer.from([255]))

			// Test value truncation for numbers outside byte range
			assert.deepEqual(DPT20.formatAPDU(256), Buffer.from([0]))
			assert.deepEqual(DPT20.formatAPDU(257), Buffer.from([1]))
		})

		test('should handle negative values', () => {
			// Test negative values (should wrap around)
			assert.deepEqual(DPT20.formatAPDU(-1), Buffer.from([255]))
			assert.deepEqual(DPT20.formatAPDU(-2), Buffer.from([254]))
		})
	})

	describe('fromBuffer', () => {
		test('should convert valid single-byte buffer to number', () => {
			// Test common HVAC mode values
			assert.equal(DPT20.fromBuffer(Buffer.from([0])), 0) // Auto
			assert.equal(DPT20.fromBuffer(Buffer.from([1])), 1) // Comfort
			assert.equal(DPT20.fromBuffer(Buffer.from([2])), 2) // Standby
			assert.equal(DPT20.fromBuffer(Buffer.from([3])), 3) // Economy
			assert.equal(DPT20.fromBuffer(Buffer.from([4])), 4) // Building Protection
		})

		test('should handle edge case buffer values', () => {
			// Test byte range limits
			assert.equal(DPT20.fromBuffer(Buffer.from([0])), 0)
			assert.equal(DPT20.fromBuffer(Buffer.from([255])), 255)
		})

		test('should handle invalid buffer lengths', () => {
			// Test empty buffer
			assert.equal(DPT20.fromBuffer(Buffer.from([])), null)

			// Test buffer too long
			assert.equal(DPT20.fromBuffer(Buffer.from([0, 1])), null)
			assert.equal(DPT20.fromBuffer(Buffer.from([0, 1, 2])), null)
		})
	})
})
