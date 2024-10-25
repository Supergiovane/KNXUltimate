import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT2 from '../../src/dptlib/dpt2'

describe('DPT2 (1-bit value with priority)', () => {
	describe('formatAPDU', () => {
		test('should correctly format valid input objects', () => {
			// Test all possible combinations of priority and data
			assert.deepEqual(
				DPT2.formatAPDU({ priority: false, data: false }),
				Buffer.from([0b00000000]),
			)
			assert.deepEqual(
				DPT2.formatAPDU({ priority: false, data: true }),
				Buffer.from([0b00000001]),
			)
			assert.deepEqual(
				DPT2.formatAPDU({ priority: true, data: false }),
				Buffer.from([0b00000010]),
			)
			assert.deepEqual(
				DPT2.formatAPDU({ priority: true, data: true }),
				Buffer.from([0b00000011]),
			)
		})
	})

	describe('fromBuffer', () => {
		test('should correctly parse valid buffers', () => {
			// Test all possible 2-bit combinations
			assert.deepEqual(DPT2.fromBuffer(Buffer.from([0b00000000])), {
				priority: false,
				data: false,
			})
			assert.deepEqual(DPT2.fromBuffer(Buffer.from([0b00000001])), {
				priority: false,
				data: true,
			})
			assert.deepEqual(DPT2.fromBuffer(Buffer.from([0b00000010])), {
				priority: true,
				data: false,
			})
			assert.deepEqual(DPT2.fromBuffer(Buffer.from([0b00000011])), {
				priority: true,
				data: true,
			})

			// Test that higher bits are ignored
			assert.deepEqual(DPT2.fromBuffer(Buffer.from([0b11111111])), {
				priority: true,
				data: true,
			})
		})

		test('should handle invalid buffer lengths', () => {
			// Empty buffer
			assert.strictEqual(DPT2.fromBuffer(Buffer.from([])), null)

			// Buffer too long
			assert.strictEqual(DPT2.fromBuffer(Buffer.from([0, 1])), null)
		})
	})
})
