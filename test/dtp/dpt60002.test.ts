/**
 * Validates KNX Data Point Type 60002 conversions.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT60002 from '../../src/dptlib/dpt60002'

describe('DPT60002 (Hager TXA223/225 Shutter Status)', () => {
	describe('formatAPDU', () => {
		test('should correctly format valid operation modes with positions', () => {
			// Test all operation modes with intermediate position
			assert.deepEqual(
				DPT60002.formatAPDU({
					mode: 'normal',
					position: 'intermediate',
				}),
				Buffer.from([0b00000000]),
			)
			assert.deepEqual(
				DPT60002.formatAPDU({
					mode: 'priority',
					position: 'intermediate',
				}),
				Buffer.from([0b00000100]),
			)
			assert.deepEqual(
				DPT60002.formatAPDU({
					mode: 'wind alarm',
					position: 'intermediate',
				}),
				Buffer.from([0b00001000]),
			)
			assert.deepEqual(
				DPT60002.formatAPDU({
					mode: 'rain alarm',
					position: 'intermediate',
				}),
				Buffer.from([0b00001100]),
			)
			assert.deepEqual(
				DPT60002.formatAPDU({
					mode: 'disabled',
					position: 'intermediate',
				}),
				Buffer.from([0b00010000]),
			)

			// Test all positions with normal mode
			assert.deepEqual(
				DPT60002.formatAPDU({
					mode: 'normal',
					position: 'intermediate',
				}),
				Buffer.from([0b00000000]),
			)
			assert.deepEqual(
				DPT60002.formatAPDU({ mode: 'normal', position: 'top' }),
				Buffer.from([0b00000001]),
			)
			assert.deepEqual(
				DPT60002.formatAPDU({ mode: 'normal', position: 'bottom' }),
				Buffer.from([0b00000010]),
			)

			// Test some combinations
			assert.deepEqual(
				DPT60002.formatAPDU({ mode: 'wind alarm', position: 'top' }),
				Buffer.from([0b00001001]),
			)
			assert.deepEqual(
				DPT60002.formatAPDU({ mode: 'disabled', position: 'bottom' }),
				Buffer.from([0b00010010]),
			)
		})

		test('should handle invalid inputs', () => {
			// Test null value
			assert.strictEqual(DPT60002.formatAPDU(null), null)
			assert.strictEqual(DPT60002.formatAPDU(undefined), null)

			// Test invalid object structure
			assert.deepEqual(
				DPT60002.formatAPDU({ mode: 'normal' } as any),
				Buffer.from([0]),
			)
			assert.deepEqual(
				DPT60002.formatAPDU({ position: 'top' } as any),
				Buffer.from([0]),
			)
			assert.deepEqual(DPT60002.formatAPDU({} as any), Buffer.from([0]))
		})
	})

	describe('fromBuffer', () => {
		test('should correctly parse valid buffers', () => {
			// Test all operation modes with intermediate position
			assert.deepEqual(DPT60002.fromBuffer(Buffer.from([0b00000000])), {
				mode: 'normal',
				position: 'intermediate',
			})
			assert.deepEqual(DPT60002.fromBuffer(Buffer.from([0b00000100])), {
				mode: 'priority',
				position: 'intermediate',
			})
			assert.deepEqual(DPT60002.fromBuffer(Buffer.from([0b00001000])), {
				mode: 'wind alarm',
				position: 'intermediate',
			})
			assert.deepEqual(DPT60002.fromBuffer(Buffer.from([0b00001100])), {
				mode: 'rain alarm',
				position: 'intermediate',
			})
			assert.deepEqual(DPT60002.fromBuffer(Buffer.from([0b00010000])), {
				mode: 'disabled',
				position: 'intermediate',
			})

			// Test all positions with normal mode
			assert.deepEqual(DPT60002.fromBuffer(Buffer.from([0b00000001])), {
				mode: 'normal',
				position: 'top',
			})
			assert.deepEqual(DPT60002.fromBuffer(Buffer.from([0b00000010])), {
				mode: 'normal',
				position: 'bottom',
			})

			// Test some combinations
			assert.deepEqual(DPT60002.fromBuffer(Buffer.from([0b00001001])), {
				mode: 'wind alarm',
				position: 'top',
			})
			assert.deepEqual(DPT60002.fromBuffer(Buffer.from([0b00010010])), {
				mode: 'disabled',
				position: 'bottom',
			})
		})

		test('should handle invalid buffers', () => {
			// Test invalid buffer lengths
			assert.strictEqual(DPT60002.fromBuffer(Buffer.from([])), null)
			assert.strictEqual(DPT60002.fromBuffer(Buffer.from([0, 1])), null)

			// Test invalid bit patterns for mode (should return null for mode)
			assert.deepEqual(DPT60002.fromBuffer(Buffer.from([0b00011000])), {
				mode: null,
				position: 'intermediate',
			})

			// Test invalid bit patterns for position (should return null for position)
			assert.deepEqual(DPT60002.fromBuffer(Buffer.from([0b00000011])), {
				mode: 'normal',
				position: null,
			})
		})
	})
})
