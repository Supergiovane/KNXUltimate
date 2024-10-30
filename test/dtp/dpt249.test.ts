import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT249 from '../../src/dptlib/dpt249'

describe('DPT249 (Brightness Colour Temperature Transition)', () => {
	describe('formatAPDU', () => {
		test('should correctly format valid input objects', () => {
			const validInput = {
				transitionTime: 100,
				colourTemperature: 1000,
				absoluteBrightness: 80,
				isTimePeriodValid: true,
				isAbsoluteColourTemperatureValid: true,
				isAbsoluteBrightnessValid: true,
			}

			const result = DPT249.formatAPDU(validInput)

			assert.ok(Buffer.isBuffer(result), 'Expected result to be a Buffer')
			assert.equal(result.length, 6)

			assert.equal(result[0], 0)
			assert.equal(result[1], 100) // transitionTime
			assert.equal(result[2], 3) // colourTemperature high byte (1000 = 0x03E8)
			assert.equal(result[3], 0xe8) // colourTemperature low byte
			assert.equal(result[4], 80) // absoluteBrightness
			assert.equal(result[5], 0b00000111) // validityFlags
		})

		test('should handle edge cases of valid ranges', () => {
			const maxValues = {
				transitionTime: 65535,
				colourTemperature: 65535,
				absoluteBrightness: 100,
				isTimePeriodValid: true,
				isAbsoluteColourTemperatureValid: true,
				isAbsoluteBrightnessValid: true,
			}

			const minValues = {
				transitionTime: 0,
				colourTemperature: 0,
				absoluteBrightness: 0,
				isTimePeriodValid: false,
				isAbsoluteColourTemperatureValid: false,
				isAbsoluteBrightnessValid: false,
			}

			const maxResult = DPT249.formatAPDU(maxValues)
			assert.ok(
				Buffer.isBuffer(maxResult),
				'Expected maxResult to be a Buffer',
			)

			// Check maxValues
			assert.equal(maxResult[0], 0xff) // transitionTime high byte
			assert.equal(maxResult[1], 0xff) // transitionTime low byte
			assert.equal(maxResult[2], 0xff) // colourTemperature high byte
			assert.equal(maxResult[3], 0xff) // colourTemperature low byte
			assert.equal(maxResult[4], 100) // absoluteBrightness
			assert.equal(maxResult[5], 0b00000111) // validityFlags

			const minResult = DPT249.formatAPDU(minValues)
			assert.ok(
				Buffer.isBuffer(minResult),
				'Expected minResult to be a Buffer',
			)

			// Check minValues
			assert.equal(minResult[0], 0) // transitionTime high byte
			assert.equal(minResult[1], 0) // transitionTime low byte
			assert.equal(minResult[2], 0) // colourTemperature high byte
			assert.equal(minResult[3], 0) // colourTemperature low byte
			assert.equal(minResult[4], 0) // absoluteBrightness
			assert.equal(minResult[5], 0) // validityFlags
		})
	})

	describe('fromBuffer', () => {
		test('should correctly parse valid buffers', () => {
			const buffer = Buffer.alloc(6)
			buffer.writeUInt16BE(100, 0) // transitionTime
			buffer.writeUInt16BE(1000, 2) // colourTemperature
			buffer.writeUInt8(80, 4) // absoluteBrightness
			buffer.writeUInt8(0b00000111, 5) // validity flags

			const result = DPT249.fromBuffer(buffer)
			assert.ok(result !== null, 'Expected result to not be null')

			assert.deepStrictEqual(result, {
				transitionTime: 100,
				colourTemperature: 1000,
				absoluteBrightness: 80,
				isTimePeriodValid: true,
				isAbsoluteColourTemperatureValid: true,
				isAbsoluteBrightnessValid: true,
			})
		})

		test('should correctly parse different validity flag combinations', () => {
			const buffer = Buffer.alloc(6)
			buffer.writeUInt16BE(100, 0)
			buffer.writeUInt16BE(1000, 2)
			buffer.writeUInt8(80, 4)

			// Test all false
			buffer.writeUInt8(0b00000000, 5)
			const resultAllFalse = DPT249.fromBuffer(buffer)
			assert.ok(resultAllFalse !== null)
			assert.equal(resultAllFalse.isTimePeriodValid, false)
			assert.equal(resultAllFalse.isAbsoluteColourTemperatureValid, false)
			assert.equal(resultAllFalse.isAbsoluteBrightnessValid, false)

			// Test mixed flags
			buffer.writeUInt8(0b00000101, 5) // First and third true
			const resultMixed = DPT249.fromBuffer(buffer)
			assert.ok(resultMixed !== null)
			assert.equal(resultMixed.isTimePeriodValid, true)
			assert.equal(resultMixed.isAbsoluteColourTemperatureValid, false)
			assert.equal(resultMixed.isAbsoluteBrightnessValid, true)
		})

		test('should handle invalid buffer lengths', () => {
			assert.strictEqual(DPT249.fromBuffer(Buffer.alloc(0)), null)
			assert.strictEqual(DPT249.fromBuffer(Buffer.alloc(5)), null)
			assert.strictEqual(DPT249.fromBuffer(Buffer.alloc(7)), null)
		})
	})
})
