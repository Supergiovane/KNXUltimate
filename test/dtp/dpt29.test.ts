import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT29 from '../../src/dptlib/dpt29'

describe('DPT29 (8-byte signed value)', () => {
	describe('formatAPDU', () => {
		test('should handle BigInt values', () => {
			// Test positive BigInt
			const value1 = BigInt('123456789')
			const resultPos = DPT29.formatAPDU(value1)
			assert.ok(resultPos instanceof Buffer)
			assert.equal(resultPos.length, 8)
			assert.equal(resultPos.readBigInt64BE(0), value1)

			// Test negative BigInt
			const value2 = BigInt('-123456789')
			const resultNeg = DPT29.formatAPDU(value2)
			assert.ok(resultNeg instanceof Buffer)
			assert.equal(resultNeg.length, 8)
			assert.equal(resultNeg.readBigInt64BE(0), value2)

			// Test zero
			const value3 = BigInt(0)
			const resultZero = DPT29.formatAPDU(value3)
			assert.ok(resultZero instanceof Buffer)
			assert.equal(resultZero.length, 8)
			assert.equal(resultZero.readBigInt64BE(0), value3)
		})

		test('should handle string values', () => {
			// Test positive string number
			const resultPosStr = DPT29.formatAPDU('123456789')
			assert.ok(resultPosStr instanceof Buffer)
			assert.equal(resultPosStr.length, 8)
			assert.equal(resultPosStr.readBigInt64BE(0), BigInt('123456789'))

			// Test negative string number
			const resultNegStr = DPT29.formatAPDU('-123456789')
			assert.ok(resultNegStr instanceof Buffer)
			assert.equal(resultNegStr.length, 8)
			assert.equal(resultNegStr.readBigInt64BE(0), BigInt('-123456789'))

			// Test zero as string
			const resultZeroStr = DPT29.formatAPDU('0')
			assert.ok(resultZeroStr instanceof Buffer)
			assert.equal(resultZeroStr.length, 8)
			assert.equal(resultZeroStr.readBigInt64BE(0), BigInt(0))
		})

		test('should handle edge values', () => {
			// Test maximum BigInt value that can be stored in 64 bits
			const maxBigInt = '9223372036854775807'
			const resultMax = DPT29.formatAPDU(maxBigInt)
			assert.ok(resultMax instanceof Buffer)
			assert.equal(resultMax.length, 8)
			assert.equal(resultMax.readBigInt64BE(0), BigInt(maxBigInt))

			// Test minimum BigInt value that can be stored in 64 bits
			const minBigInt = '-9223372036854775808'
			const resultMin = DPT29.formatAPDU(minBigInt)
			assert.ok(resultMin instanceof Buffer)
			assert.equal(resultMin.length, 8)
			assert.equal(resultMin.readBigInt64BE(0), BigInt(minBigInt))
		})
	})

	describe('fromBuffer', () => {
		test('should correctly read positive values from buffer', () => {
			const value = BigInt('123456789')
			const buf = Buffer.alloc(8)
			buf.writeBigInt64BE(value)
			const result = DPT29.fromBuffer(buf)
			assert.ok(typeof result === 'bigint')
			assert.equal(result, value)
		})

		test('should correctly read negative values from buffer', () => {
			const value = BigInt('-123456789')
			const buf = Buffer.alloc(8)
			buf.writeBigInt64BE(value)
			const result = DPT29.fromBuffer(buf)
			assert.ok(typeof result === 'bigint')
			assert.equal(result, value)
		})

		test('should handle zero value', () => {
			const value = BigInt(0)
			const buf = Buffer.alloc(8)
			buf.writeBigInt64BE(value)
			const result = DPT29.fromBuffer(buf)
			assert.ok(typeof result === 'bigint')
			assert.equal(result, value)
		})

		test('should handle edge values', () => {
			// Test maximum value
			const maxVal = BigInt('9223372036854775807')
			const bufMax = Buffer.alloc(8)
			bufMax.writeBigInt64BE(maxVal)
			const resultMax = DPT29.fromBuffer(bufMax)
			assert.ok(typeof resultMax === 'bigint')
			assert.equal(resultMax, maxVal)

			// Test minimum value
			const minVal = BigInt('-9223372036854775808')
			const bufMin = Buffer.alloc(8)
			bufMin.writeBigInt64BE(minVal)
			const resultMin = DPT29.fromBuffer(bufMin)
			assert.ok(typeof resultMin === 'bigint')
			assert.equal(resultMin, minVal)
		})
	})
})
