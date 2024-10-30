import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT3 from '../../src/dptlib/dpt3'

describe('DPT3 (4-bit relative dimming control)', () => {
	describe('formatAPDU', () => {
		test('should correctly format valid input objects', () => {
			// Test decrease with different data values
			assert.deepEqual(
				DPT3.formatAPDU({ decr_incr: 0, data: 0 }),
				Buffer.from([0b00000000]),
			)
			assert.deepEqual(
				DPT3.formatAPDU({ decr_incr: 0, data: 7 }),
				Buffer.from([0b00000111]),
			)

			// Test increase with different data values
			assert.deepEqual(
				DPT3.formatAPDU({ decr_incr: 1, data: 0 }),
				Buffer.from([0b00001000]),
			)
			assert.deepEqual(
				DPT3.formatAPDU({ decr_incr: 1, data: 7 }),
				Buffer.from([0b00001111]),
			)

			// Test data value masking (values > 7 should be masked to 7)
			assert.deepEqual(
				DPT3.formatAPDU({ decr_incr: 0, data: 15 }),
				Buffer.from([0b00000111]),
			)
		})

		test('should handle edge cases', () => {
			// Negative data values should be masked to their 3-bit representation
			assert.deepEqual(
				DPT3.formatAPDU({ decr_incr: 0, data: -1 }),
				Buffer.from([0b00000111]),
			)

			// Very large data values should be masked to their 3-bit representation
			assert.deepEqual(
				DPT3.formatAPDU({ decr_incr: 1, data: 255 }),
				Buffer.from([0b00001111]),
			)
		})
	})

	describe('fromBuffer', () => {
		test('should correctly parse valid buffers', () => {
			// Test decrease values
			assert.deepEqual(DPT3.fromBuffer(Buffer.from([0b00000000])), {
				decr_incr: 0,
				data: 0,
			})
			assert.deepEqual(DPT3.fromBuffer(Buffer.from([0b00000111])), {
				decr_incr: 0,
				data: 7,
			})

			// Test increase values
			assert.deepEqual(DPT3.fromBuffer(Buffer.from([0b00001000])), {
				decr_incr: 1,
				data: 0,
			})
			assert.deepEqual(DPT3.fromBuffer(Buffer.from([0b00001111])), {
				decr_incr: 1,
				data: 7,
			})

			// Test that higher bits are ignored
			assert.deepEqual(DPT3.fromBuffer(Buffer.from([0b11111111])), {
				decr_incr: 1,
				data: 7,
			})
		})

		test('should handle invalid buffer lengths', () => {
			// Empty buffer
			assert.strictEqual(DPT3.fromBuffer(Buffer.from([])), null)

			// Buffer too long
			assert.strictEqual(DPT3.fromBuffer(Buffer.from([0, 1])), null)
		})
	})
})
