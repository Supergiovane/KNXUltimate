/**
 * Validates KNX Data Point Type 18 conversions.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT18 from '../../src/dptlib/dpt18'

describe('DPT18 (8-bit Scene Control)', () => {
	describe('formatAPDU', () => {
		test('should handle invalid inputs', () => {
			// Test null value
			assert.equal(DPT18.formatAPDU(null), null)
			assert.equal(DPT18.formatAPDU(undefined), null)

			// Test invalid object structure
			assert.equal(DPT18.formatAPDU({ invalid: 'object' } as any), null)
			assert.equal(DPT18.formatAPDU({ save_recall: 0 } as any), null)
			assert.equal(DPT18.formatAPDU({ scenenumber: 1 } as any), null)
		})
	})

	describe('fromBuffer', () => {
		test('should correctly parse scene recall commands', () => {
			// Test parsing of scene recall commands
			assert.deepEqual(DPT18.fromBuffer(Buffer.from([0b00000000])), {
				save_recall: 0,
				scenenumber: 1,
			})
			assert.deepEqual(DPT18.fromBuffer(Buffer.from([0b00000001])), {
				save_recall: 0,
				scenenumber: 2,
			})
			assert.deepEqual(DPT18.fromBuffer(Buffer.from([0b00111111])), {
				save_recall: 0,
				scenenumber: 64,
			})
		})

		test('should correctly parse scene save commands', () => {
			// Test parsing of scene save commands
			assert.deepEqual(DPT18.fromBuffer(Buffer.from([0b10000000])), {
				save_recall: 1,
				scenenumber: 1,
			})
			assert.deepEqual(DPT18.fromBuffer(Buffer.from([0b10000001])), {
				save_recall: 1,
				scenenumber: 2,
			})
			assert.deepEqual(DPT18.fromBuffer(Buffer.from([0b10111111])), {
				save_recall: 1,
				scenenumber: 64,
			})
		})

		test('should handle invalid buffer lengths', () => {
			// Test empty buffer
			assert.strictEqual(DPT18.fromBuffer(Buffer.from([])), null)

			// Test buffer too long
			assert.strictEqual(DPT18.fromBuffer(Buffer.from([0, 1])), null)
			assert.strictEqual(DPT18.fromBuffer(Buffer.from([0, 1, 2])), null)
		})

		test('should correctly handle reserved bit', () => {
			// The second bit is reserved and should be ignored in parsing
			assert.deepEqual(DPT18.fromBuffer(Buffer.from([0b00000000])), {
				save_recall: 0,
				scenenumber: 1,
			})
			assert.deepEqual(DPT18.fromBuffer(Buffer.from([0b01000000])), {
				save_recall: 0,
				scenenumber: 1,
			})
		})
	})
})
