/**
 * Validates KNX Data Point Type 242 conversions.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT242 from '../../src/dptlib/dpt242'

describe('DPT242 (RGB xyY)', () => {
	describe('formatAPDU', () => {
		test('should correctly format valid RGB xyY values', () => {
			const validValue = {
				x: 500,
				y: 500,
				brightness: 80,
				isColorValid: true,
				isBrightnessValid: true,
			}

			const result = DPT242.formatAPDU(validValue)
			assert.ok(Buffer.isBuffer(result))
			assert.equal(result.length, 6)

			// Check x value (first 2 bytes)
			assert.equal((result[0] << 8) | result[1], 500)

			// Check y value (next 2 bytes)
			assert.equal((result[2] << 8) | result[3], 500)

			// Check brightness value
			assert.equal(result[4], 80)

			// Check flags byte
			assert.equal(result[5], 0b00000011) // Both flags set
		})

		test('should handle boundary values', () => {
			const maxValue = {
				x: 65535,
				y: 65535,
				brightness: 100,
				isColorValid: true,
				isBrightnessValid: true,
			}

			const result = DPT242.formatAPDU(maxValue)
			assert.equal((result[0] << 8) | result[1], 65535) // x
			assert.equal((result[2] << 8) | result[3], 65535) // y
			assert.equal(result[4], 100) // brightness
			assert.equal(result[5], 0b00000011) // flags

			const minValue = {
				x: 0,
				y: 0,
				brightness: 0,
				isColorValid: false,
				isBrightnessValid: false,
			}

			const resultMin = DPT242.formatAPDU(minValue)
			assert.equal((resultMin[0] << 8) | resultMin[1], 0) // x
			assert.equal((resultMin[2] << 8) | resultMin[3], 0) // y
			assert.equal(resultMin[4], 0) // brightness
			assert.equal(resultMin[5], 0) // flags cleared
		})

		test('should handle different flag combinations', () => {
			const colorValidOnly = {
				x: 1000,
				y: 1000,
				brightness: 50,
				isColorValid: true,
				isBrightnessValid: false,
			}

			const result1 = DPT242.formatAPDU(colorValidOnly)
			assert.equal(result1[5], 0b00000010)

			const brightnessValidOnly = {
				x: 1000,
				y: 1000,
				brightness: 50,
				isColorValid: false,
				isBrightnessValid: true,
			}

			const result2 = DPT242.formatAPDU(brightnessValidOnly)
			assert.equal(result2[5], 0b00000001)
		})
	})

	describe('fromBuffer', () => {
		test('should correctly parse valid buffers', () => {
			// Create a test buffer with known values
			const buffer = Buffer.from([
				0x03,
				0xe8, // x = 1000 (0x03E8)
				0x07,
				0xd0, // y = 2000 (0x07D0)
				0x4b, // brightness = 75 (0x4B)
				0x03, // both flags set
			])

			const result = DPT242.fromBuffer(buffer)
			assert.deepStrictEqual(result, {
				x: 1000,
				y: 2000,
				brightness: 75,
				isColorValid: true,
				isBrightnessValid: true,
			})
		})

		test('should correctly parse boundary values', () => {
			const maxBuffer = Buffer.from([
				0xff,
				0xff, // x = 65535
				0xff,
				0xff, // y = 65535
				0x64, // brightness = 100
				0x03, // both flags
			])

			const maxResult = DPT242.fromBuffer(maxBuffer)
			assert.deepStrictEqual(maxResult, {
				x: 65535,
				y: 65535,
				brightness: 100,
				isColorValid: true,
				isBrightnessValid: true,
			})

			const minBuffer = Buffer.alloc(6) // All zeros
			const minResult = DPT242.fromBuffer(minBuffer)
			assert.deepStrictEqual(minResult, {
				x: 0,
				y: 0,
				brightness: 0,
				isColorValid: false,
				isBrightnessValid: false,
			})
		})

		test('should handle different flag combinations', () => {
			const buffer1 = Buffer.from([
				0x01,
				0xf4, // x = 500
				0x01,
				0xf4, // y = 500
				0x32, // brightness = 50
				0x02, // only color valid
			])

			const result1 = DPT242.fromBuffer(buffer1)
			assert.strictEqual(result1.isColorValid, true)
			assert.strictEqual(result1.isBrightnessValid, false)

			const buffer2 = Buffer.from([
				0x01,
				0xf4, // x = 500
				0x01,
				0xf4, // y = 500
				0x32, // brightness = 50
				0x01, // only brightness valid
			])

			const result2 = DPT242.fromBuffer(buffer2)
			assert.strictEqual(result2.isColorValid, false)
			assert.strictEqual(result2.isBrightnessValid, true)
		})

		test('should return null for invalid buffer length', () => {
			assert.strictEqual(DPT242.fromBuffer(Buffer.alloc(0)), null)
			assert.strictEqual(DPT242.fromBuffer(Buffer.alloc(5)), null)
			assert.strictEqual(DPT242.fromBuffer(Buffer.alloc(7)), null)
		})
	})
})
