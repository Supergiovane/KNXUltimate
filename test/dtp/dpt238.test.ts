import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT238 from '../../src/dptlib/dpt238'

describe('DPT238 (1-byte unsigned value)', () => {
	describe('formatAPDU', () => {
		test('should convert numeric values to 1-byte buffer', () => {
			// Test boundary values
			assert.deepEqual(DPT238.formatAPDU(0), Buffer.from([0]))
			assert.deepEqual(DPT238.formatAPDU(255), Buffer.from([255]))

			// Test mid-range values
			assert.deepEqual(DPT238.formatAPDU(128), Buffer.from([128]))
			assert.deepEqual(DPT238.formatAPDU(64), Buffer.from([64]))
			assert.deepEqual(DPT238.formatAPDU(192), Buffer.from([192]))
		})

		test('should handle edge cases', () => {
			// Values greater than 255 should be truncated to 8 bits
			assert.deepEqual(DPT238.formatAPDU(256), Buffer.from([0]))
			assert.deepEqual(DPT238.formatAPDU(257), Buffer.from([1]))

			// Negative values should wrap around
			assert.deepEqual(DPT238.formatAPDU(-1), Buffer.from([255]))
			assert.deepEqual(DPT238.formatAPDU(-2), Buffer.from([254]))

			// Floating point values should be truncated
			assert.deepEqual(DPT238.formatAPDU(128.7), Buffer.from([128]))
			assert.deepEqual(DPT238.formatAPDU(128.2), Buffer.from([128]))
		})
	})

	describe('fromBuffer', () => {
		test('should convert valid 1-byte buffer to number', () => {
			// Test boundary values
			assert.equal(DPT238.fromBuffer(Buffer.from([0])), 0)
			assert.equal(DPT238.fromBuffer(Buffer.from([255])), 255)

			// Test mid-range values
			assert.equal(DPT238.fromBuffer(Buffer.from([128])), 128)
			assert.equal(DPT238.fromBuffer(Buffer.from([64])), 64)
			assert.equal(DPT238.fromBuffer(Buffer.from([192])), 192)
		})

		test('should handle invalid buffer lengths', () => {
			// Empty buffer
			assert.strictEqual(DPT238.fromBuffer(Buffer.from([])), null)

			// Buffer too long
			assert.strictEqual(DPT238.fromBuffer(Buffer.from([0, 1])), null)
			assert.strictEqual(DPT238.fromBuffer(Buffer.from([0, 1, 2])), null)
		})
	})
})
