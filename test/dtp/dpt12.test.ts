import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT12 from '../../src/dptlib/dpt12'

describe('DPT12 (4-byte unsigned value)', () => {
	describe('formatAPDU', () => {
		test('should correctly format valid numeric values', () => {
			// Test basic values
			assert.deepEqual(DPT12.formatAPDU(0), Buffer.from([0, 0, 0, 0]))
			assert.deepEqual(DPT12.formatAPDU(1), Buffer.from([0, 0, 0, 1]))
			assert.deepEqual(DPT12.formatAPDU(256), Buffer.from([0, 0, 1, 0]))

			// Test larger values
			assert.deepEqual(
				DPT12.formatAPDU(16777216),
				Buffer.from([1, 0, 0, 0]),
			) // 2^24
			assert.deepEqual(
				DPT12.formatAPDU(4294967295),
				Buffer.from([255, 255, 255, 255]),
			) // max 32-bit unsigned
		})

		test('should handle numeric edge cases', () => {
			// Test floating point numbers - should be truncated
			assert.deepEqual(
				DPT12.formatAPDU(123.45),
				Buffer.from([0, 0, 0, 123]),
			)

			// Test MAX_SAFE_INTEGER - should be capped at 32-bit max
			const maxInt = Math.min(Number.MAX_SAFE_INTEGER, 4294967295)
			const maxResult = DPT12.formatAPDU(maxInt)
			assert.ok(Buffer.isBuffer(maxResult))
			assert.equal(maxResult.length, 4)
		})
	})

	describe('fromBuffer', () => {
		test('should correctly parse valid buffers', () => {
			// Test basic values
			assert.equal(DPT12.fromBuffer(Buffer.from([0, 0, 0, 0])), 0)
			assert.equal(DPT12.fromBuffer(Buffer.from([0, 0, 0, 1])), 1)
			assert.equal(DPT12.fromBuffer(Buffer.from([0, 0, 1, 0])), 256)

			// Test larger values
			assert.equal(DPT12.fromBuffer(Buffer.from([1, 0, 0, 0])), 16777216) // 2^24
			assert.equal(
				DPT12.fromBuffer(Buffer.from([255, 255, 255, 255])),
				4294967295,
			) // max 32-bit unsigned
		})

		test('should handle invalid buffer lengths', () => {
			// Empty buffer
			assert.strictEqual(DPT12.fromBuffer(Buffer.from([])), null)

			// Buffer too short
			assert.strictEqual(DPT12.fromBuffer(Buffer.from([0, 0, 0])), null)

			// Buffer too long
			assert.strictEqual(
				DPT12.fromBuffer(Buffer.from([0, 0, 0, 0, 0])),
				null,
			)
		})

		test('should handle different buffer patterns', () => {
			// Test buffer with alternating bits
			assert.equal(
				DPT12.fromBuffer(Buffer.from([170, 170, 170, 170])),
				2863311530,
			)

			// Test buffer with all bits set in different bytes
			assert.equal(
				DPT12.fromBuffer(Buffer.from([255, 0, 0, 0])),
				4278190080,
			)
			assert.equal(
				DPT12.fromBuffer(Buffer.from([0, 255, 0, 0])),
				16711680,
			)
			assert.equal(DPT12.fromBuffer(Buffer.from([0, 0, 255, 0])), 65280)
			assert.equal(DPT12.fromBuffer(Buffer.from([0, 0, 0, 255])), 255)
		})
	})
})
