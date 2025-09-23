/**
 * Validates KNX Data Point Type 251 conversions.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT251 from '../../src/dptlib/dpt251'

describe('DPT251 (RGBW array)', () => {
	describe('formatAPDU', () => {
		test('should correctly format valid RGBW values', () => {
			const testValue = {
				red: 90,
				green: 200,
				blue: 30,
				white: 120,
				mR: 1,
				mG: 1,
				mB: 1,
				mW: 1,
			}

			const result = DPT251.formatAPDU(testValue)
			assert.ok(Buffer.isBuffer(result))
			assert.equal(result.length, 6)
			assert.deepEqual(result, Buffer.from([90, 200, 30, 120, 0, 15])) // 15 = 0b00001111 for all valid bits
		})

		test('should handle boundary values', () => {
			const maxValue = {
				red: 255,
				green: 255,
				blue: 255,
				white: 255,
				mR: 1,
				mG: 1,
				mB: 1,
				mW: 1,
			}

			const minValue = {
				red: 0,
				green: 0,
				blue: 0,
				white: 0,
				mR: 0,
				mG: 0,
				mB: 0,
				mW: 0,
			}

			const maxResult = DPT251.formatAPDU(maxValue)
			assert.deepEqual(
				maxResult,
				Buffer.from([255, 255, 255, 255, 0, 15]),
			)

			const minResult = DPT251.formatAPDU(minValue)
			assert.deepEqual(minResult, Buffer.from([0, 0, 0, 0, 0, 0]))
		})

		test('should handle different validity combinations', () => {
			const partialValid = {
				red: 100,
				green: 150,
				blue: 200,
				white: 250,
				mR: 1,
				mG: 0,
				mB: 1,
				mW: 0,
			}

			const result = DPT251.formatAPDU(partialValid)
			assert.deepEqual(result, Buffer.from([100, 150, 200, 250, 0, 10])) // 10 = 0b00001010 for R and B valid
		})

		test('should floor decimal values', () => {
			const decimalValues = {
				red: 100.6,
				green: 150.2,
				blue: 200.7,
				white: 250.1,
				mR: 1,
				mG: 1,
				mB: 1,
				mW: 1,
			}

			const result = DPT251.formatAPDU(decimalValues)
			assert.deepEqual(result, Buffer.from([100, 150, 200, 250, 0, 15]))
		})
	})

	describe('fromBuffer', () => {
		test('should correctly parse valid buffers', () => {
			const buffer = Buffer.from([90, 200, 30, 120, 0, 15]) // All valid bits set
			const result = DPT251.fromBuffer(buffer)

			assert.deepEqual(result, {
				red: 90,
				green: 200,
				blue: 30,
				white: 120,
				mR: 1,
				mG: 1,
				mB: 1,
				mW: 1,
			})
		})

		test('should handle different validity combinations', () => {
			// Only R and B valid (0b00001010 = 10)
			const buffer = Buffer.from([100, 150, 200, 250, 0, 10])
			const result = DPT251.fromBuffer(buffer)

			assert.deepEqual(result, {
				red: 100,
				green: 150,
				blue: 200,
				white: 250,
				mR: 1,
				mG: 0,
				mB: 1,
				mW: 0,
			})
		})

		test('should handle boundary values', () => {
			const maxBuffer = Buffer.from([255, 255, 255, 255, 0, 15])
			const maxResult = DPT251.fromBuffer(maxBuffer)

			assert.deepEqual(maxResult, {
				red: 255,
				green: 255,
				blue: 255,
				white: 255,
				mR: 1,
				mG: 1,
				mB: 1,
				mW: 1,
			})

			const minBuffer = Buffer.from([0, 0, 0, 0, 0, 0])
			const minResult = DPT251.fromBuffer(minBuffer)

			assert.deepEqual(minResult, {
				red: 0,
				green: 0,
				blue: 0,
				white: 0,
				mR: 0,
				mG: 0,
				mB: 0,
				mW: 0,
			})
		})

		test('should handle invalid buffer lengths', () => {
			// Too short
			assert.equal(DPT251.fromBuffer(Buffer.from([1, 2, 3, 4, 5])), null)

			// Too long
			assert.equal(
				DPT251.fromBuffer(Buffer.from([1, 2, 3, 4, 5, 6, 7])),
				null,
			)

			// Empty buffer
			assert.equal(DPT251.fromBuffer(Buffer.from([])), null)
		})
	})
})
