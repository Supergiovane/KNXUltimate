import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT18 from '../../src/dptlib/dpt18'

describe('DPT18 (8-bit Scene Control)', () => {
	describe('formatAPDU', () => {
		test('should correctly format scene recall commands', () => {
			// Test scene recall (save_recall = 0) for different scene numbers
			assert.deepEqual(
				DPT18.formatAPDU({ save_recall: 0, scenenumber: 1 }),
				Buffer.from([0b00000000]),
			)
			assert.deepEqual(
				DPT18.formatAPDU({ save_recall: 0, scenenumber: 2 }),
				Buffer.from([0b00000001]),
			)
			assert.deepEqual(
				DPT18.formatAPDU({ save_recall: 0, scenenumber: 64 }),
				Buffer.from([0b00111111]),
			)
		})

		test('should handle invalid inputs', () => {
			// Test null value
			assert.equal(DPT18.formatAPDU(null), undefined)
			assert.equal(DPT18.formatAPDU(undefined), undefined)

			// Test invalid object structure
			assert.deepEqual(
				DPT18.formatAPDU({ invalid: 'object' } as any),
				Buffer.from([0]),
			)
			assert.deepEqual(
				DPT18.formatAPDU({ save_recall: 0 } as any),
				Buffer.from([0]),
			)
			assert.deepEqual(
				DPT18.formatAPDU({ scenenumber: 1 } as any),
				Buffer.from([0]),
			)
		})
	})

	describe('fromBuffer', () => {
		test('should correctly parse scene recall commands', () => {
			// Test parsing of scene recall commands
			assert.deepEqual(DPT18.fromBuffer(Buffer.from([0b00000000])), {
				save_recall: 0,
				scenenumber: 1,
			})
			assert.deepEqual(DPT18.fromBuffer(Buffer.from([0b00000001])), {
				save_recall: 0,
				scenenumber: 2,
			})
			assert.deepEqual(DPT18.fromBuffer(Buffer.from([0b00111111])), {
				save_recall: 0,
				scenenumber: 64,
			})
		})

		test('should correctly parse scene save commands', () => {
			// Test parsing of scene save commands
			assert.deepEqual(DPT18.fromBuffer(Buffer.from([0b10000000])), {
				save_recall: 1,
				scenenumber: 1,
			})
			assert.deepEqual(DPT18.fromBuffer(Buffer.from([0b10000001])), {
				save_recall: 1,
				scenenumber: 2,
			})
			assert.deepEqual(DPT18.fromBuffer(Buffer.from([0b10111111])), {
				save_recall: 1,
				scenenumber: 64,
			})
		})

		test('should handle invalid buffer lengths', () => {
			// Test empty buffer
			assert.strictEqual(DPT18.fromBuffer(Buffer.from([])), null)

			// Test buffer too long
			assert.strictEqual(DPT18.fromBuffer(Buffer.from([0, 1])), null)
			assert.strictEqual(DPT18.fromBuffer(Buffer.from([0, 1, 2])), null)
		})

		test('should correctly handle reserved bit', () => {
			// The second bit is reserved and should be ignored in parsing
			assert.deepEqual(DPT18.fromBuffer(Buffer.from([0b00000000])), {
				save_recall: 0,
				scenenumber: 1,
			})
			assert.deepEqual(DPT18.fromBuffer(Buffer.from([0b01000000])), {
				save_recall: 0,
				scenenumber: 1,
			})
		})
	})
})
