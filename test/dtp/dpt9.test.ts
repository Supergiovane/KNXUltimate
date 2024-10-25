import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT9 from '../../src/dptlib/dpt9'

describe('DPT9 (16-bit floating point value)', () => {
	describe('formatAPDU', () => {
		test('should correctly format zero', () => {
			const result = DPT9.formatAPDU(0)
			if (!result) {
				assert.fail('formatAPDU returned undefined')
				return
			}
			assert.deepEqual(result, Buffer.from([0x00, 0x00]))
		})

		test('should correctly format positive integers', () => {
			const value = 10
			const result = DPT9.formatAPDU(value)
			if (!result) {
				assert.fail('formatAPDU returned undefined')
				return
			}
			const decoded = DPT9.fromBuffer(result)
			assert.ok(Math.abs(decoded - value) < 0.1)
		})

		test('should correctly format negative integers', () => {
			const value = -10
			const result = DPT9.formatAPDU(value)
			if (!result) {
				assert.fail('formatAPDU returned undefined')
				return
			}
			const decoded = DPT9.fromBuffer(result)
			assert.ok(Math.abs(decoded - value) < 0.1)
		})

		test('should correctly format decimal numbers', () => {
			const testCases = [0.5, 20.2]
			for (const value of testCases) {
				const result = DPT9.formatAPDU(value)
				if (!result) {
					assert.fail(`formatAPDU returned undefined for ${value}`)
					return
				}
				assert.ok(Buffer.isBuffer(result))
				assert.equal(result.length, 2)
				const decoded = DPT9.fromBuffer(result)
				assert.ok(Math.abs(decoded - value) < 0.1)
			}
		})

		test('should handle numbers with many decimal places', () => {
			const value = 10.123456
			const result = DPT9.formatAPDU(value)
			if (!result) {
				assert.fail('formatAPDU returned undefined')
				return
			}
			const decoded = DPT9.fromBuffer(result)
			assert.ok(Math.abs(decoded - 10.12) < 0.1) // Check if it's close to 10.12
		})

		test('should handle invalid inputs', () => {
			const cases = [
				{ value: NaN, desc: 'NaN' },
				{ value: undefined, desc: 'undefined' },
				{ value: null, desc: 'null' },
			] as const

			for (const { value, desc } of cases) {
				const result = DPT9.formatAPDU(value)
				if (!result) {
					assert.fail(`formatAPDU returned undefined for ${desc}`)
					return
				}
				assert.deepEqual(
					result,
					Buffer.from([0x00, 0x00]),
					`Failed for value: ${desc}`,
				)
			}
		})

		test('should convert string numbers to numeric values', () => {
			const value = 10.5
			const result = DPT9.formatAPDU(value.toString())
			if (!result) {
				assert.fail('formatAPDU returned undefined')
				return
			}
			const decoded = DPT9.fromBuffer(result)
			assert.ok(Math.abs(decoded - value) < 0.1)
		})
	})

	describe('fromBuffer', () => {
		test('should correctly parse zero', () => {
			const result = DPT9.fromBuffer(Buffer.from([0x00, 0x00]))
			assert.equal(result, 0)
		})

		test('should handle bidirectional conversion', () => {
			const testValues = [1, 10, -1, -10, 0.5, 20.2]
			for (const value of testValues) {
				const buffer = DPT9.formatAPDU(value)
				if (!buffer) {
					assert.fail(`formatAPDU returned undefined for ${value}`)
					return
				}
				const result = DPT9.fromBuffer(buffer)
				assert.ok(
					Math.abs(result - value) < 0.1,
					`Value ${value} was not preserved through conversion cycle. Got ${result}`,
				)
			}
		})

		test('should handle invalid buffer lengths', () => {
			const cases = [
				{ buffer: Buffer.from([]), desc: 'empty buffer' },
				{ buffer: Buffer.from([0x00]), desc: 'buffer too short' },
				{
					buffer: Buffer.from([0x00, 0x00, 0x00]),
					desc: 'buffer too long',
				},
			]

			for (const { buffer, desc } of cases) {
				const result = DPT9.fromBuffer(buffer)
				assert.equal(result, null, `Failed for ${desc}`)
			}
		})

		test('should handle extreme values', () => {
			const maxResult = DPT9.fromBuffer(Buffer.from([0x7f, 0xff]))
			assert.ok(maxResult > 0, 'Max positive value should be positive')

			const minResult = DPT9.fromBuffer(Buffer.from([0xff, 0xff]))
			assert.ok(minResult < 0, 'Max negative value should be negative')
		})
	})
})
