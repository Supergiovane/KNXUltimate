/**
 * Validates KNX Data Point Type 1 conversions.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT1 from '../../src/dptlib/dpt1'

describe('DPT1 (1-bit value)', () => {
	describe('formatAPDU', () => {
		test('should handle numeric values', () => {
			// Zero should be converted to 0
			assert.deepEqual(DPT1.formatAPDU(0), Buffer.from([0]))
			assert.deepEqual(DPT1.formatAPDU('0'), Buffer.from([0]))

			// Any non-zero number should be converted to 1
			assert.deepEqual(DPT1.formatAPDU(1), Buffer.from([1]))
			assert.deepEqual(DPT1.formatAPDU('1'), Buffer.from([1]))
			assert.deepEqual(DPT1.formatAPDU(42), Buffer.from([1]))
			assert.deepEqual(DPT1.formatAPDU('42'), Buffer.from([1]))
		})

		test('should handle boolean values', () => {
			assert.deepEqual(DPT1.formatAPDU(true), Buffer.from([1]))
			assert.deepEqual(DPT1.formatAPDU(false), Buffer.from([0]))
			assert.deepEqual(DPT1.formatAPDU('true'), Buffer.from([1]))
			assert.deepEqual(DPT1.formatAPDU('false'), Buffer.from([0]))
		})
	})
})
