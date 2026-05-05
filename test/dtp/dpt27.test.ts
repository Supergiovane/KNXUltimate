/**
 * Validates KNX Data Point Type 27 conversions.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT27 from '../../src/dptlib/dpt27'

describe('DPT27 (combined info on/off)', () => {
	describe('formatAPDU', () => {
		test('should encode mask/state payload', () => {
			assert.deepEqual(
				DPT27.formatAPDU!({ mask: 0xffff, state: 0x0005 }),
				Buffer.from([0xff, 0xff, 0x00, 0x05]),
			)
		})

		test('should encode raw uint32 payload', () => {
			assert.deepEqual(
				DPT27.formatAPDU!(0x12345678),
				Buffer.from([0x12, 0x34, 0x56, 0x78]),
			)
		})

		test('should reject invalid payloads', () => {
			assert.equal(DPT27.formatAPDU!({ mask: 0x1_0000, state: 0 }), null)
			assert.equal(DPT27.formatAPDU!(-1), null)
		})
	})

	describe('fromBuffer', () => {
		test('should decode mask/state and channel flags', () => {
			const decoded = DPT27.fromBuffer!(
				Buffer.from([0xff, 0xff, 0x00, 0x05]),
			)
			assert.equal(decoded?.mask, 0xffff)
			assert.equal(decoded?.state, 0x0005)
			assert.equal(decoded?.outputs[0].available, true) // channel 1
			assert.equal(decoded?.outputs[0].on, true)
			assert.equal(decoded?.outputs[1].on, false) // channel 2
			assert.equal(decoded?.outputs[2].on, true) // channel 3
		})

		test('should reject invalid buffer lengths', () => {
			assert.equal(DPT27.fromBuffer!(Buffer.from([])), null)
			assert.equal(DPT27.fromBuffer!(Buffer.from([0, 1, 2])), null)
		})
	})
})
