import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT213 from '../../src/dptlib/dpt213'

describe('DPT213 (4x 16-Bit Signed Value)', () => {
	describe('formatAPDU', () => {
		test('should correctly format valid temperature values', () => {
			const validTemp = {
				Comfort: 21.4,
				Standby: 20,
				Economy: 18.2,
				BuildingProtection: -1,
			}

			const result = DPT213.formatAPDU(validTemp)
			assert.ok(Buffer.isBuffer(result))
			assert.equal(result?.length, 8)
		})

		test('should handle boundary values', () => {
			const boundaryValues = {
				Comfort: -271.98,
				Standby: 655.32,
				Economy: -200,
				BuildingProtection: 500,
			}

			const result = DPT213.formatAPDU(boundaryValues)
			assert.ok(Buffer.isBuffer(result))
			assert.equal(result?.length, 8)
		})

		test('should return undefined for values outside range', () => {
			const invalidTemp = {
				Comfort: -273,
				Standby: 20,
				Economy: 18.2,
				BuildingProtection: -1,
			}

			const result = DPT213.formatAPDU(invalidTemp)
			assert.equal(result, null)

			const invalidTemp2 = {
				Comfort: 21.4,
				Standby: 656,
				Economy: 18.2,
				BuildingProtection: -1,
			}

			const result2 = DPT213.formatAPDU(invalidTemp2)
			assert.equal(result2, null)
		})

		test('should return undefined for invalid object structure', () => {
			// Test missing properties
			const result1 = DPT213.formatAPDU({
				Comfort: 21.4,
				Standby: 20,
				Economy: 18.2,
				// BuildingProtection missing
			})
			assert.equal(result1, null)

			// Test wrong property names
			const result2 = DPT213.formatAPDU({
				comfort: 21.4,
				standby: 20,
				economy: 18.2,
				buildingProtection: -1,
			} as any)
			assert.equal(result2, null)
		})
	})

	describe('fromBuffer', () => {
		test('should correctly parse valid buffer', () => {
			const validTemp = {
				Comfort: 21.4,
				Standby: 20,
				Economy: 18.2,
				BuildingProtection: -1,
			}

			const buffer = DPT213.formatAPDU(validTemp)
			assert.ok(buffer)

			const result = DPT213.fromBuffer(buffer)
			assert.ok(result)

			// Check properties existence and type
			const properties = [
				'Comfort',
				'Standby',
				'Economy',
				'BuildingProtection',
			]
			properties.forEach((key) => {
				assert.ok(key in result, `Property ${key} should exist`)
				assert.equal(
					typeof result[key],
					'number',
					`${key} should be a number`,
				)
			})
		})

		test('should handle boundary values', () => {
			// Using values slightly within limits to avoid rounding issues
			const boundaryValues = {
				Comfort: -271.98,
				Standby: 655.32,
				Economy: -200,
				BuildingProtection: 500,
			}

			const buffer = DPT213.formatAPDU(boundaryValues)
			assert.ok(buffer)

			const result = DPT213.fromBuffer(buffer)
			assert.ok(result)

			// Check properties existence and type
			const properties = [
				'Comfort',
				'Standby',
				'Economy',
				'BuildingProtection',
			]
			properties.forEach((key) => {
				assert.ok(key in result, `Property ${key} should exist`)
				assert.equal(
					typeof result[key],
					'number',
					`${key} should be a number`,
				)
			})

			// Check values are within valid range
			const inRange = (val: number) => val >= -272 && val <= 655.34
			assert.ok(inRange(result.Comfort), 'Comfort should be in range')
			assert.ok(inRange(result.Standby), 'Standby should be in range')
			assert.ok(inRange(result.Economy), 'Economy should be in range')
			assert.ok(
				inRange(result.BuildingProtection),
				'BuildingProtection should be in range',
			)
		})

		test('should return null for invalid buffer length', () => {
			assert.equal(DPT213.fromBuffer(Buffer.alloc(6)), null)
			assert.equal(DPT213.fromBuffer(Buffer.alloc(10)), null)
			assert.equal(DPT213.fromBuffer(Buffer.alloc(0)), null)
		})

		test('should maintain precision for decimal values', () => {
			const testValues = {
				Comfort: 21.42,
				Standby: 20.06,
				Economy: 18.24,
				BuildingProtection: -1.08,
			}

			const apdu = DPT213.formatAPDU(testValues)
			assert.ok(Buffer.isBuffer(apdu))

			const result = DPT213.fromBuffer(apdu)
			assert.ok(result)

			const delta = 0.03
			assert.ok(Math.abs(result.Comfort - testValues.Comfort) < delta)
			assert.ok(Math.abs(result.Standby - testValues.Standby) < delta)
			assert.ok(Math.abs(result.Economy - testValues.Economy) < delta)
			assert.ok(
				Math.abs(
					result.BuildingProtection - testValues.BuildingProtection,
				) < delta,
			)
		})
	})

	describe('Round trip', () => {
		test('should maintain values after encode/decode cycle', () => {
			const originalValues = {
				Comfort: 21.4,
				Standby: 20,
				Economy: 18.2,
				BuildingProtection: -1,
			}

			const encoded = DPT213.formatAPDU(originalValues)
			assert.ok(Buffer.isBuffer(encoded))

			const decoded = DPT213.fromBuffer(encoded)
			assert.ok(decoded)

			const delta = 0.03
			assert.ok(
				Math.abs(decoded.Comfort - originalValues.Comfort) < delta,
			)
			assert.ok(
				Math.abs(decoded.Standby - originalValues.Standby) < delta,
			)
			assert.ok(
				Math.abs(decoded.Economy - originalValues.Economy) < delta,
			)
			assert.ok(
				Math.abs(
					decoded.BuildingProtection -
						originalValues.BuildingProtection,
				) < delta,
			)
		})
	})
})
