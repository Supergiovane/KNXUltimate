/**
 * Validates KNX Data Point Type 232 conversions.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT232 from '../../src/dptlib/dpt232'

describe('DPT232 (3-byte RGB color array)', () => {
	describe('formatAPDU', () => {
		test('should format valid RGB values correctly', () => {
			// Test pure red
			assert.deepEqual(
				DPT232.formatAPDU({ red: 255, green: 0, blue: 0 }),
				Buffer.from([255, 0, 0]),
			)

			// Test pure green
			assert.deepEqual(
				DPT232.formatAPDU({ red: 0, green: 255, blue: 0 }),
				Buffer.from([0, 255, 0]),
			)

			// Test pure blue
			assert.deepEqual(
				DPT232.formatAPDU({ red: 0, green: 0, blue: 255 }),
				Buffer.from([0, 0, 255]),
			)

			// Test mixed color
			assert.deepEqual(
				DPT232.formatAPDU({ red: 128, green: 64, blue: 32 }),
				Buffer.from([128, 64, 32]),
			)
		})

		test('should handle floating point values by flooring them', () => {
			assert.deepEqual(
				DPT232.formatAPDU({ red: 128.7, green: 64.2, blue: 32.9 }),
				Buffer.from([128, 64, 32]),
			)
		})
	})

	describe('fromBuffer', () => {
		test('should parse valid buffers correctly', () => {
			// Test pure colors
			assert.deepEqual(DPT232.fromBuffer(Buffer.from([255, 0, 0])), {
				red: 255,
				green: 0,
				blue: 0,
			})
			assert.deepEqual(DPT232.fromBuffer(Buffer.from([0, 255, 0])), {
				red: 0,
				green: 255,
				blue: 0,
			})
			assert.deepEqual(DPT232.fromBuffer(Buffer.from([0, 0, 255])), {
				red: 0,
				green: 0,
				blue: 255,
			})

			// Test mixed color
			assert.deepEqual(DPT232.fromBuffer(Buffer.from([128, 64, 32])), {
				red: 128,
				green: 64,
				blue: 32,
			})
		})

		test('should handle invalid buffer lengths', () => {
			// Test empty buffer
			assert.strictEqual(DPT232.fromBuffer(Buffer.from([])), null)

			// Test buffer too short
			assert.strictEqual(DPT232.fromBuffer(Buffer.from([255, 0])), null)

			// Test buffer too long
			assert.strictEqual(
				DPT232.fromBuffer(Buffer.from([255, 0, 0, 0])),
				null,
			)
		})
	})
})
