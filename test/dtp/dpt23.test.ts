/**
 * Validates KNX Data Point Type 23 conversions.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT23 from '../../src/dptlib/dpt23'

describe('DPT23 (2-bit enumeration)', () => {
	describe('formatAPDU', () => {
		test('should format valid values (0..3)', () => {
			assert.deepEqual(DPT23.formatAPDU!(0), Buffer.from([0]))
			assert.deepEqual(DPT23.formatAPDU!(1), Buffer.from([1]))
			assert.deepEqual(DPT23.formatAPDU!(2), Buffer.from([2]))
			assert.deepEqual(DPT23.formatAPDU!(3), Buffer.from([3]))
		})

		test('should reject invalid values', () => {
			assert.equal(DPT23.formatAPDU!(-1), null)
			assert.equal(DPT23.formatAPDU!(4), null)
			assert.equal(DPT23.formatAPDU!('x'), null)
		})
	})

	describe('fromBuffer', () => {
		test('should decode low 2 bits', () => {
			assert.equal(DPT23.fromBuffer!(Buffer.from([0b00000000])), 0)
			assert.equal(DPT23.fromBuffer!(Buffer.from([0b00000011])), 3)
			assert.equal(DPT23.fromBuffer!(Buffer.from([0b11111110])), 2)
		})

		test('should reject invalid buffer lengths', () => {
			assert.equal(DPT23.fromBuffer!(Buffer.from([])), null)
			assert.equal(DPT23.fromBuffer!(Buffer.from([0, 1])), null)
		})
	})
})
