import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT275 from '../../src/dptlib/dpt275'

describe('DPT275 (Quadruple setpoints)', () => {
	describe('formatAPDU', () => {
		test('should format valid complete object to buffer', () => {
			const value = {
				comfort: 22,
				standby: 21.5,
				economy: 21,
				buildingProtection: 15,
			}

			const result = DPT275.formatAPDU(value)
			assert.ok(Buffer.isBuffer(result))
			assert.equal(result.length, 8) // 4 values * 2 bytes each
		})

		test('should return undefined for incomplete objects', () => {
			// Missing buildingProtection
			const value1 = {
				comfort: 22,
				standby: 21.5,
				economy: 21,
			}
			assert.equal(DPT275.formatAPDU(value1), null)

			// Missing comfort
			const value2 = {
				standby: 21.5,
				economy: 21,
				buildingProtection: 15,
			}
			assert.equal(DPT275.formatAPDU(value2), null)

			// Missing economy
			const value3 = {
				comfort: 22,
				standby: 21.5,
				buildingProtection: 15,
			}
			assert.equal(DPT275.formatAPDU(value3), null)

			// Missing standby
			const value4 = {
				comfort: 22,
				economy: 21,
				buildingProtection: 15,
			}
			assert.equal(DPT275.formatAPDU(value4), null)
		})
	})

	describe('fromBuffer', () => {
		test('should parse valid buffer to object', () => {
			// Create a sample 8-byte buffer (2 bytes per value)
			const buffer = Buffer.from([
				0x0c,
				0x1a, // comfort: 22°C
				0x0c,
				0x0c, // standby: 21.5°C
				0x0c,
				0x00, // economy: 21°C
				0x0b,
				0x70, // buildingProtection: 15°C
			])

			const result = DPT275.fromBuffer(buffer)
			assert.ok(result)
			assert.ok(typeof result === 'object')
			assert.ok('comfort' in result)
			assert.ok('standby' in result)
			assert.ok('economy' in result)
			assert.ok('buildingProtection' in result)
		})

		test('should return null for invalid buffer lengths', () => {
			// Empty buffer
			assert.equal(DPT275.fromBuffer(Buffer.from([])), null)

			// Buffer too short (7 bytes)
			assert.equal(DPT275.fromBuffer(Buffer.alloc(7)), null)

			// Buffer too long (9 bytes)
			assert.equal(DPT275.fromBuffer(Buffer.alloc(9)), null)
		})

		test('should parse a complete cycle of values', () => {
			const originalValues = {
				comfort: 22,
				standby: 21.5,
				economy: 21,
				buildingProtection: 15,
			}

			// First format to buffer
			const buffer = DPT275.formatAPDU(originalValues)
			assert.ok(buffer)

			// Then parse back
			const result = DPT275.fromBuffer(buffer)
			assert.ok(result)

			// Check if values are approximately equal (floating point comparison)
			assert.ok(Math.abs(result.comfort - originalValues.comfort) < 0.1)
			assert.ok(Math.abs(result.standby - originalValues.standby) < 0.1)
			assert.ok(Math.abs(result.economy - originalValues.economy) < 0.1)
			assert.ok(
				Math.abs(
					result.buildingProtection -
						originalValues.buildingProtection,
				) < 0.1,
			)
		})
	})
})
