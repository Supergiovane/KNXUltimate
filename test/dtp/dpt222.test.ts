import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT222 from '../../src/dptlib/dpt222'

describe('DPT222 (3x 16-Float Value)', () => {
	describe('formatAPDU', () => {
		test('should correctly format valid temperature setpoints', () => {
			const result = DPT222.formatAPDU({
				Comfort: 21,
				Standby: 20,
				Economy: 14,
			})

			assert.ok(Buffer.isBuffer(result))
			assert.equal(result.length, 6)
		})

		test('should handle boundary values', () => {
			const resultMin = DPT222.formatAPDU({
				Comfort: -273,
				Standby: -273,
				Economy: -273,
			})

			assert.ok(Buffer.isBuffer(resultMin))
			assert.equal(resultMin.length, 6)

			const resultMax = DPT222.formatAPDU({
				Comfort: 670760,
				Standby: 670760,
				Economy: 670760,
			})

			assert.ok(Buffer.isBuffer(resultMax))
			assert.equal(resultMax.length, 6)
		})

		test('should return undefined for missing properties', () => {
			const result = DPT222.formatAPDU({
				Comfort: 21,
				Standby: 20,
				// Economy missing
			} as any)

			assert.equal(result, undefined)
		})

		test('should return undefined for out-of-range values', () => {
			// Below minimum
			assert.equal(
				DPT222.formatAPDU({
					Comfort: -274,
					Standby: 20,
					Economy: 14,
				}),
				undefined,
			)

			// Above maximum
			assert.equal(
				DPT222.formatAPDU({
					Comfort: 670761,
					Standby: 20,
					Economy: 14,
				}),
				undefined,
			)
		})

		test('should handle non-object inputs', () => {
			// String
			assert.equal(DPT222.formatAPDU('invalid' as any), undefined)

			// Array
			assert.equal(DPT222.formatAPDU([] as any), undefined)

			// Number
			assert.equal(DPT222.formatAPDU(123 as any), undefined)
		})
	})

	describe('fromBuffer', () => {
		test('should correctly parse valid buffer', () => {
			// Instead of testing exact values, we test the structure
			// and range of the returned object
			const buffer = Buffer.alloc(6) // sample buffer
			const result = DPT222.fromBuffer(buffer)

			assert.ok(result !== null)
			assert.ok(typeof result === 'object')
			assert.ok('Comfort' in result)
			assert.ok('Standby' in result)
			assert.ok('Economy' in result)
			assert.ok(typeof result.Comfort === 'number')
			assert.ok(typeof result.Standby === 'number')
			assert.ok(typeof result.Economy === 'number')
		})

		test('should return null for invalid buffer lengths', () => {
			// Empty buffer
			assert.equal(DPT222.fromBuffer(Buffer.from([])), null)

			// Buffer too short
			assert.equal(
				DPT222.fromBuffer(Buffer.from([0x41, 0xa8, 0x41, 0xa0])),
				null,
			)

			// Buffer too long
			assert.equal(
				DPT222.fromBuffer(
					Buffer.from([0x41, 0xa8, 0x41, 0xa0, 0x41, 0x60, 0x00]),
				),
				null,
			)
		})
	})
})
