/**
 * Validates KNX Data Point Type 26 conversions.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT26 from '../../src/dptlib/dpt26'

describe('DPT26 (scene info)', () => {
	describe('formatAPDU', () => {
		test('should encode info bit and scene number', () => {
			assert.deepEqual(
				DPT26.formatAPDU!({ info: false, scenenumber: 0 }),
				Buffer.from([0x00]),
			)
			assert.deepEqual(
				DPT26.formatAPDU!({ info: true, scenenumber: 3 }),
				Buffer.from([0x43]),
			)
		})

		test('should reject invalid scene numbers', () => {
			assert.equal(
				DPT26.formatAPDU!({ info: false, scenenumber: -1 }),
				null,
			)
			assert.equal(
				DPT26.formatAPDU!({ info: true, scenenumber: 64 }),
				null,
			)
		})
	})

	describe('fromBuffer', () => {
		test('should decode info and scene number', () => {
			assert.deepEqual(DPT26.fromBuffer!(Buffer.from([0x00])), {
				info: false,
				scenenumber: 0,
			})
			assert.deepEqual(DPT26.fromBuffer!(Buffer.from([0x7f])), {
				info: true,
				scenenumber: 63,
			})
		})

		test('should reject invalid buffer lengths', () => {
			assert.equal(DPT26.fromBuffer!(Buffer.from([])), null)
			assert.equal(DPT26.fromBuffer!(Buffer.from([0, 1])), null)
		})
	})
})
