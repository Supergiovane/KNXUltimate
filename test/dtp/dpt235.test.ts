import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT235 from '../../src/dptlib/dpt235'

describe('DPT235 (Tariff Active Energy)', () => {
	describe('formatAPDU', () => {
		test('should correctly format valid input objects', () => {
			const result = DPT235.formatAPDU({
				activeElectricalEnergy: 1540,
				tariff: 20,
				validityTariff: true,
				validityEnergy: true,
			})

			assert.ok(Buffer.isBuffer(result))
			assert.equal(result.length, 6)

			// Check activeElectricalEnergy (first 4 bytes)
			const energyBuffer = Buffer.alloc(4)
			energyBuffer.writeInt32BE(1540)
			assert.deepEqual(result.subarray(0, 4), energyBuffer)

			// Check tariff (5th byte)
			assert.equal(result[4], 20)

			// Check validity bits (6th byte)
			// Both validityTariff and validityEnergy are true, so last two bits should be 11
			assert.equal(result[5], 0b00000011)
		})

		test('should handle negative energy values', () => {
			const result = DPT235.formatAPDU({
				activeElectricalEnergy: -1540,
				tariff: 20,
				validityTariff: true,
				validityEnergy: true,
			})

			assert.ok(Buffer.isBuffer(result))

			// Check negative value is correctly encoded
			const energyBuffer = Buffer.alloc(4)
			energyBuffer.writeInt32BE(-1540)
			assert.deepEqual(result.subarray(0, 4), energyBuffer)
		})

		test('should handle different validity combinations', () => {
			// Test all validity combinations
			const testCases = [
				{
					input: {
						activeElectricalEnergy: 1000,
						tariff: 1,
						validityTariff: false,
						validityEnergy: false,
					},
					expectedValidity: 0b00000000,
				},
				{
					input: {
						activeElectricalEnergy: 1000,
						tariff: 1,
						validityTariff: true,
						validityEnergy: false,
					},
					expectedValidity: 0b00000010,
				},
				{
					input: {
						activeElectricalEnergy: 1000,
						tariff: 1,
						validityTariff: false,
						validityEnergy: true,
					},
					expectedValidity: 0b00000001,
				},
				{
					input: {
						activeElectricalEnergy: 1000,
						tariff: 1,
						validityTariff: true,
						validityEnergy: true,
					},
					expectedValidity: 0b00000011,
				},
			]

			testCases.forEach((testCase) => {
				const result = DPT235.formatAPDU(testCase.input)
				assert.equal(result[5], testCase.expectedValidity)
			})
		})

		test('should handle invalid input', () => {
			const invalidInputs = [
				{},
				{ activeElectricalEnergy: 1540 },
				{ tariff: 20 },
				{ validityTariff: true },
				{ validityEnergy: true },
				null,
				null,
				'invalid',
			]

			invalidInputs.forEach((input) => {
				const result = DPT235.formatAPDU(input)
				assert.equal(result, null)
			})
		})
	})

	describe('fromBuffer', () => {
		test('should correctly parse valid buffers', () => {
			// Create a test buffer
			const buffer = Buffer.alloc(6)
			buffer.writeInt32BE(1540, 0) // activeElectricalEnergy
			buffer[4] = 20 // tariff
			buffer[5] = 0b00000011 // validityTariff and validityEnergy both true

			const result = DPT235.fromBuffer(buffer)

			assert.deepEqual(result, {
				activeElectricalEnergy: 1540,
				tariff: 20,
				validityTariff: true,
				validityEnergy: true,
			})
		})

		test('should correctly parse negative energy values', () => {
			const buffer = Buffer.alloc(6)
			buffer.writeInt32BE(-1540, 0) // negative activeElectricalEnergy
			buffer[4] = 20
			buffer[5] = 0b00000011

			const result = DPT235.fromBuffer(buffer)

			assert.deepEqual(result, {
				activeElectricalEnergy: -1540,
				tariff: 20,
				validityTariff: true,
				validityEnergy: true,
			})
		})

		test('should handle all validity combinations', () => {
			const testCases = [
				{
					validity: 0b00000000,
					expected: { validityTariff: false, validityEnergy: false },
				},
				{
					validity: 0b00000010,
					expected: { validityTariff: true, validityEnergy: false },
				},
				{
					validity: 0b00000001,
					expected: { validityTariff: false, validityEnergy: true },
				},
				{
					validity: 0b00000011,
					expected: { validityTariff: true, validityEnergy: true },
				},
			]

			testCases.forEach((testCase) => {
				const buffer = Buffer.alloc(6)
				buffer.writeInt32BE(1000, 0)
				buffer[4] = 1
				buffer[5] = testCase.validity

				const result = DPT235.fromBuffer(buffer)
				assert.equal(
					result.validityTariff,
					testCase.expected.validityTariff,
				)
				assert.equal(
					result.validityEnergy,
					testCase.expected.validityEnergy,
				)
			})
		})
	})
})
