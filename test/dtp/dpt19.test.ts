/**
 * Validates KNX Data Point Type 19 conversions.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT19 from '../../src/dptlib/dpt19'

describe('DPT19 (8-byte Date and Time)', () => {
	describe('formatAPDU', () => {
		test('should correctly format a Date object', () => {
			// Create a specific date for testing (2024-03-15 14:30:45)
			const testDate = new Date(2024, 2, 15, 14, 30, 45)
			const result = DPT19.formatAPDU(testDate)

			assert.ok(Buffer.isBuffer(result))
			assert.equal(result.length, 8)
			assert.equal(result[0], 124) // 2024 - 1900
			assert.equal(result[1], 3) // March (1-based)
			assert.equal(result[2], 15) // Day of month
			assert.equal(result[3], (5 << 5) + 14) // Friday (5) and hours (14)
			assert.equal(result[4], 30) // Minutes
			assert.equal(result[5], 45) // Seconds
			assert.equal(result[6], 0) // Reserved
			assert.equal(result[7], 0) // Reserved
		})

		test('should handle Sunday correctly (day 0 to 7 conversion)', () => {
			// Create a Sunday (2024-03-17 12:00:00)
			const testDate = new Date(2024, 2, 17, 12, 0, 0)
			const result = DPT19.formatAPDU(testDate)

			assert.ok(Buffer.isBuffer(result))
			assert.equal(result[3], (7 << 5) + 12) // Sunday (7) and hours (12)
		})

		test('should handle dates around epoch and year boundaries', () => {
			// Test year 2000
			const date2000 = new Date(2000, 0, 1, 0, 0, 0)
			const result2000 = DPT19.formatAPDU(date2000)
			assert.equal(result2000[0], 100) // 2000 - 1900

			// Test recent date
			const date2023 = new Date(2023, 11, 31, 23, 59, 59)
			const result2023 = DPT19.formatAPDU(date2023)
			assert.equal(result2023[0], 123) // 2023 - 1900
			assert.equal(result2023[1], 12) // December
			assert.equal(result2023[2], 31) // Last day
			assert.equal(result2023[4], 59) // Minutes
			assert.equal(result2023[5], 59) // Seconds
		})
	})

	describe('fromBuffer', () => {
		test('should correctly parse valid date buffers', () => {
			// Create a buffer representing 2024-03-15 14:30:45
			const buffer = Buffer.from([
				124,
				3,
				15,
				(5 << 5) + 14,
				30,
				45,
				0,
				0,
			])
			const result = DPT19.fromBuffer(buffer)

			assert.ok(result instanceof Date)
			assert.equal(result.getFullYear(), 2024)
			assert.equal(result.getMonth(), 2) // March (0-based)
			assert.equal(result.getDate(), 15)
			assert.equal(result.getHours(), 14)
			assert.equal(result.getMinutes(), 30)
			assert.equal(result.getSeconds(), 45)
		})

		test('should handle year boundaries correctly', () => {
			// Test year 2000
			const buffer2000 = Buffer.from([100, 1, 1, 14, 0, 0, 0, 0])
			const result2000 = DPT19.fromBuffer(buffer2000)
			assert.equal(result2000.getFullYear(), 2000)

			// Test recent date
			const buffer2023 = Buffer.from([123, 12, 31, 23, 59, 59, 0, 0])
			const result2023 = DPT19.fromBuffer(buffer2023)
			assert.equal(result2023.getFullYear(), 2023)
			assert.equal(result2023.getMonth(), 11) // December (0-based)
			assert.equal(result2023.getDate(), 31)
		})

		test('should handle invalid buffer sizes', () => {
			// Test empty buffer
			assert.strictEqual(DPT19.fromBuffer(Buffer.from([])), null)

			// Test buffer too short
			assert.strictEqual(
				DPT19.fromBuffer(Buffer.from([124, 3, 15])),
				null,
			)

			// Test buffer too long
			assert.strictEqual(
				DPT19.fromBuffer(
					Buffer.from([124, 3, 15, 14, 30, 45, 0, 0, 0]),
				),
				null,
			)
		})

		test('should extract hours correctly from combined day/hour byte', () => {
			// Test various day/hour combinations
			const buffer1 = Buffer.from([124, 3, 15, (1 << 5) + 12, 0, 0, 0, 0]) // Monday 12:00
			const result1 = DPT19.fromBuffer(buffer1)
			assert.equal(result1.getHours(), 12)

			const buffer2 = Buffer.from([124, 3, 15, (7 << 5) + 23, 0, 0, 0, 0]) // Sunday 23:00
			const result2 = DPT19.fromBuffer(buffer2)
			assert.equal(result2.getHours(), 23)
		})
	})
})
