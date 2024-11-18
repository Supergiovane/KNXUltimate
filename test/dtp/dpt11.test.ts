import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT11 from '../../src/dptlib/dpt11'

describe('DPT11 (3-byte date value)', () => {
	describe('formatAPDU', () => {
		test('should format Date object correctly', () => {
			const testDate = new Date(2023, 9, 15) // October 15, 2023
			const result = DPT11.formatAPDU(testDate)

			assert.ok(Buffer.isBuffer(result))
			assert.equal(result.length, 3)
			assert.equal(result[0], 15) // day
			assert.equal(result[1], 10) // month (1-based)
			assert.equal(result[2], 23) // year
		})

		test('should handle date string input', () => {
			const result = DPT11.formatAPDU('2023-10-15')

			assert.ok(Buffer.isBuffer(result))
			assert.equal(result[0], 15) // day
			assert.equal(result[1], 10) // month (1-based)
			assert.equal(result[2], 23) // year
		})

		test('should handle timestamp number input', () => {
			const timestamp = new Date(2023, 9, 15).getTime()
			const result = DPT11.formatAPDU(timestamp)

			assert.ok(Buffer.isBuffer(result))
			assert.equal(result[0], 15) // day
			assert.equal(result[1], 10) // month (1-based)
			assert.equal(result[2], 23) // year
		})

		test('should handle object with day/month/year properties', () => {
			const dateObj = { day: 15, month: 9, year: 2023 } // month is 0-based
			const result = DPT11.formatAPDU(dateObj)

			assert.ok(Buffer.isBuffer(result))
			assert.equal(result[0], 15) // day
			assert.equal(result[1], 10) // month (1-based)
			assert.equal(result[2], 23) // year
		})

		test('should handle dates in 1900s', () => {
			const oldDate = new Date(1995, 11, 25) // December 25, 1995
			const result = DPT11.formatAPDU(oldDate)

			assert.ok(Buffer.isBuffer(result))
			assert.equal(result[0], 25) // day
			assert.equal(result[1], 12) // month (1-based)
			assert.equal(result[2], 95) // year
		})

		test('should return undefined for invalid inputs', () => {
			assert.equal(DPT11.formatAPDU(null), null)
			assert.equal(DPT11.formatAPDU(undefined), null)
		})

		test('should handle invalid date objects', () => {
			const invalidDate = new Date('invalid')
			const result = DPT11.formatAPDU(invalidDate)
			assert.ok(Buffer.isBuffer(result))
			assert.equal(result[0], 0)
			assert.equal(result[1], 0)
			assert.equal(result[2], 0)
		})
	})

	describe('fromBuffer', () => {
		test('should parse valid date buffers correctly', () => {
			const buffer = Buffer.from([15, 10, 23]) // October 15, 2023
			const result = DPT11.fromBuffer(buffer)

			assert.ok(result instanceof Date)
			assert.equal(result.getDate(), 15)
			assert.equal(result.getMonth(), 9) // 0-based month
			assert.equal(result.getFullYear(), 2023)
		})

		test('should parse 1900s dates correctly', () => {
			const buffer = Buffer.from([25, 12, 95]) // December 25, 1995
			const result = DPT11.fromBuffer(buffer)

			assert.ok(result instanceof Date)
			assert.equal(result.getDate(), 25)
			assert.equal(result.getMonth(), 11) // 0-based month
			assert.equal(result.getFullYear(), 1995)
		})

		test('should handle invalid buffer lengths', () => {
			assert.equal(DPT11.fromBuffer(Buffer.from([1, 2])), null) // Too short
			assert.equal(DPT11.fromBuffer(Buffer.from([1, 2, 3, 4])), null) // Too long
		})

		test('should handle masked values correctly', () => {
			const buffer = Buffer.from([0b11111111, 0b11111111, 0b11111111])
			// Should mask to day=31, month=15, year=127
			assert.throws(() => {
				DPT11.fromBuffer(buffer)
			}, Error)
		})
	})
})
