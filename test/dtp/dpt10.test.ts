import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT10 from '../../src/dptlib/dpt10'

describe('DPT10 (time of day)', () => {
	describe('formatAPDU', () => {
		test('should format time from string input', () => {
			// Test valid time string
			const result = DPT10.formatAPDU('14:30:45')
			assert.ok(Buffer.isBuffer(result))
			assert.equal(result.length, 3)
			assert.equal(result[0] & 0b00011111, 14) // hours
			assert.equal(result[1], 30) // minutes
			assert.equal(result[2], 45) // seconds

			// Another valid time
			const result2 = DPT10.formatAPDU('23:59:59')
			assert.equal(result2[0] & 0b00011111, 23)
			assert.equal(result2[1], 59)
			assert.equal(result2[2], 59)

			// Early morning time
			const result3 = DPT10.formatAPDU('00:00:01')
			assert.equal(result3[0] & 0b00011111, 0)
			assert.equal(result3[1], 0)
			assert.equal(result3[2], 1)
		})

		test('should format time from Date object', () => {
			const testDate = new Date(2024, 0, 1, 15, 30, 45) // January 1, 2024, 15:30:45
			const result = DPT10.formatAPDU(testDate)

			assert.equal(result[0] & 0b00011111, 15) // hours
			assert.equal(result[1], 30) // minutes
			assert.equal(result[2], 45) // seconds
		})

		test('should format time from timestamp number', () => {
			const timestamp = new Date(2024, 0, 1, 16, 30, 45).getTime()
			const result = DPT10.formatAPDU(timestamp)

			assert.equal(result[0] & 0b00011111, 16) // hours
			assert.equal(result[1], 30) // minutes
			assert.equal(result[2], 45) // seconds
		})

		test('should handle invalid inputs', () => {
			// Invalid time string format
			const result1 = DPT10.formatAPDU('invalid time')
			assert.ok(Buffer.isBuffer(result1))
			assert.equal(result1.length, 3)

			// Invalid object type
			const result2 = DPT10.formatAPDU({} as any)
			assert.ok(Buffer.isBuffer(result2))
			assert.equal(result2.length, 3)
		})
	})

	describe('fromBuffer', () => {
		test('should parse valid time buffers', () => {
			// Test 14:30:45
			// Hours (14) in lowest 5 bits: 14 = 0b01110
			// Bits: 000|01110
			const buffer = Buffer.from([14, 30, 45])
			const result = DPT10.fromBuffer(buffer)

			assert.ok(result instanceof Date)
			assert.equal(result.getHours(), 14)
			assert.equal(result.getMinutes(), 30)
			assert.equal(result.getSeconds(), 45)
		})

		test('should handle day of week in buffer', () => {
			// Test Sunday (7/0) 12:00:00
			// Hours (12) in lowest 5 bits: 12 = 0b01100
			// Day (7) in highest 3 bits: 7 = 0b111
			// Combined: 0b11101100
			const bufferSunday = Buffer.from([0b11101100, 0, 0])
			const resultSunday = DPT10.fromBuffer(bufferSunday)
			assert.equal(resultSunday.getHours(), 12)

			// Test Monday (1) 12:00:00
			// Hours (12) in lowest 5 bits: 12 = 0b01100
			// Day (1) in highest 3 bits: 1 = 0b001
			// Combined: 0b00101100
			const bufferMonday = Buffer.from([0b00101100, 0, 0])
			const resultMonday = DPT10.fromBuffer(bufferMonday)
			assert.equal(resultMonday.getHours(), 12)
		})

		test('should handle edge time values', () => {
			// Test 00:00:00
			const buffer1 = Buffer.from([0, 0, 0])
			const result1 = DPT10.fromBuffer(buffer1)
			assert.equal(result1.getHours(), 0)
			assert.equal(result1.getMinutes(), 0)
			assert.equal(result1.getSeconds(), 0)

			// Test 23:59:59
			// Hours (23) in lowest 5 bits: 23 = 0b10111
			const buffer2 = Buffer.from([23, 59, 59])
			const result2 = DPT10.fromBuffer(buffer2)
			assert.equal(result2.getHours(), 23)
			assert.equal(result2.getMinutes(), 59)
			assert.equal(result2.getSeconds(), 59)
		})

		test('should handle invalid buffer inputs', () => {
			// Wrong buffer length
			assert.strictEqual(DPT10.fromBuffer(Buffer.from([0, 0])), null)
			assert.strictEqual(
				DPT10.fromBuffer(Buffer.from([0, 0, 0, 0])),
				null,
			)

			// Invalid time values
			const bufferInvalidHour = Buffer.from([31, 0, 0]) // hour > 23
			const resultInvalidHour = DPT10.fromBuffer(bufferInvalidHour)
			assert.ok(resultInvalidHour instanceof Date)

			const bufferInvalidMinute = Buffer.from([0, 60, 0]) // minute > 59
			const resultInvalidMinute = DPT10.fromBuffer(bufferInvalidMinute)
			assert.ok(resultInvalidMinute instanceof Date)

			const bufferInvalidSecond = Buffer.from([0, 0, 60]) // second > 59
			const resultInvalidSecond = DPT10.fromBuffer(bufferInvalidSecond)
			assert.ok(resultInvalidSecond instanceof Date)
		})
	})
})
