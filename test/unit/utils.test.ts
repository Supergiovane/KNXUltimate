import { describe, it } from 'node:test'
import assert from 'assert'
import {
	hasProp,
	hex2bin,
	hexToDec,
	ldexp,
	frexp,
	getHex,
	getFloat,
	wait,
	round,
} from '../../src/utils'

describe('utils', () => {
	describe('hasProp', () => {
		it('should return true for existing properties', () => {
			const obj = { a: 1, b: 2 }
			assert.strictEqual(hasProp(obj, 'a'), true)
		})

		it('should return false for non-existing properties', () => {
			const obj = { a: 1, b: 2 }
			assert.strictEqual(hasProp(obj, 'c'), false)
		})
	})

	describe('hex2bin', () => {
		it('should correctly convert hex to binary', () => {
			assert.strictEqual(hex2bin('FF'), '11111111')
			assert.strictEqual(hex2bin('A5'), '10100101')
		})
	})

	describe('hexToDec', () => {
		it('should correctly convert hex to decimal', () => {
			assert.strictEqual(hexToDec('FF'), 255)
			assert.strictEqual(hexToDec('A5'), 165)
		})

		it('should handle lowercase hex', () => {
			assert.strictEqual(hexToDec('ff'), 255)
		})
	})

	describe('ldexp', () => {
		it('should correctly compute ldexp for positive exponents', () => {
			assert.strictEqual(ldexp(1.5, 3), 12)
		})

		it('should correctly compute ldexp for negative exponents', () => {
			assert.strictEqual(ldexp(0.75, -1), 0.375)
		})

		it('should handle edge cases', () => {
			assert.strictEqual(ldexp(1, 1024), Infinity)
			assert.strictEqual(ldexp(1, -1075), 0)
		})
	})

	describe('frexp', () => {
		it('should correctly decompose positive numbers', () => {
			const [mantissa, exponent] = frexp(12)
			assert.strictEqual(mantissa, 0.75)
			assert.strictEqual(exponent, 4)
		})

		it('should correctly decompose negative numbers', () => {
			const [mantissa, exponent] = frexp(-12)
			assert.strictEqual(mantissa, -0.75)
			assert.strictEqual(exponent, 4)
		})

		it('should handle zero', () => {
			const [mantissa, exponent] = frexp(0)
			assert.strictEqual(mantissa, 0)
			assert.strictEqual(exponent, 0)
		})
	})

	describe('getHex', () => {
		it('should convert float to 2-byte hex array', () => {
			const result = getHex(12.34)
			assert.ok(result, 'getHex should return a value')
			assert.ok(Array.isArray(result), 'Result should be an array')
			assert.strictEqual(
				result.length,
				2,
				'Result should have 2 elements',
			)
			assert.ok(
				result[0] >= 0 && result[0] <= 255,
				'First byte should be between 0 and 255',
			)
			assert.ok(
				result[1] >= 0 && result[1] <= 255,
				'Second byte should be between 0 and 255',
			)
		})

		it('should handle negative numbers', () => {
			const result = getHex(-12.34)
			assert.ok(
				result,
				'getHex should return a value for negative numbers',
			)
			assert.ok(Array.isArray(result), 'Result should be an array')
			assert.strictEqual(
				result.length,
				2,
				'Result should have 2 elements',
			)
			assert.ok(
				result[0] & 0x80,
				'Sign bit should be set for negative numbers',
			)
		})

		it('should handle zero', () => {
			const result = getHex(0)
			assert.ok(result, 'getHex should return a value for zero')
			assert.deepStrictEqual(
				result,
				[0, 0],
				'Result for zero should be [0, 0]',
			)
		})

		it('should handle very large numbers', () => {
			const result = getHex(1e38)
			assert.ok(
				result,
				'getHex should return a value for very large numbers',
			)
			assert.ok(Array.isArray(result), 'Result should be an array')
			assert.strictEqual(
				result.length,
				2,
				'Result should have 2 elements',
			)
		})

		it('should handle very small numbers', () => {
			const result = getHex(1e-38)
			assert.ok(
				result,
				'getHex should return a value for very small numbers',
			)
			assert.ok(Array.isArray(result), 'Result should be an array')
			assert.strictEqual(
				result.length,
				2,
				'Result should have 2 elements',
			)
		})
	})

	describe('getFloat', () => {
		it('should convert 2-byte array to float', () => {
			const hex = getHex(12.34)
			assert.ok(hex)
			const float = getFloat(hex[0], hex[1])
			assert.ok(Math.abs(float - 12.34) < 0.01)
		})

		it('should handle negative numbers', () => {
			const hex = getHex(-12.34)
			assert.ok(hex)
			const float = getFloat(hex[0], hex[1])
			assert.ok(Math.abs(float + 12.34) < 0.01)
		})
	})

	describe('wait', () => {
		it('should wait for the specified time', async () => {
			const start = Date.now()
			await wait(100) // wait for 100 ms
			const elapsed = Date.now() - start
			// Allow generous margin for execution time on busy CI hosts
			assert(elapsed >= 100 && elapsed < 300)
		})
	})

	describe('round', () => {
		it('should round numbers correctly', () => {
			assert.strictEqual(round(1.2345, 2), 1.23)
			assert.strictEqual(round(1.2365, 2), 1.24)
			assert.strictEqual(round(123.456, 0), 123)
		})

		it('should handle negative numbers', () => {
			assert.strictEqual(round(-1.2345, 2), -1.23)
			assert.strictEqual(round(-1.2365, 2), -1.24)
		})

		it('should handle zero', () => {
			assert.strictEqual(round(0, 2), 0)
		})
		it('should correctly round numbers like 1.255', () => {
			assert.strictEqual(round(1.255 + Number.EPSILON, 2), 1.26)
		})

		it('should correctly round results of multiplication involving 1.255', () => {
			assert.strictEqual(
				round((1.255 * 100 + Number.EPSILON) / 100, 2),
				1.26,
			)
		})

		it('should correctly round results of division involving 1.255', () => {
			assert.strictEqual(round(1.255 / 2 + Number.EPSILON, 3), 0.628)
		})
	})
})
