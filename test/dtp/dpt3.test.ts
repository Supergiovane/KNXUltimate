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

	describe('basetype', () => {
		test('should have correct properties', () => {
			assert.strictEqual(DPT3.basetype.bitlength, 4)
			assert.strictEqual(DPT3.basetype.valuetype, 'composite')
			assert.strictEqual(
				DPT3.basetype.desc,
				'4-bit relative dimming control',
			)
			assert.ok(DPT3.basetype.help.includes('dimming'))
			assert.ok(DPT3.basetype.helplink.includes('Sample---Dimming'))
		})
	})

	describe('subtypes', () => {
		test('should have correct dimming control (007) subtype', () => {
			const dimmingControl = DPT3.subtypes['007']
			assert.strictEqual(dimmingControl.name, 'Dimming control')
			assert.strictEqual(dimmingControl.desc, 'dimming control')
		})

		test('should have correct blinds control (008) subtype', () => {
			const blindsControl = DPT3.subtypes['008']
			assert.strictEqual(blindsControl.name, 'Blinds control')
			assert.strictEqual(blindsControl.desc, 'blinds control')
		})

		test('should verify all subtypes have required properties', () => {
			Object.entries(DPT3.subtypes).forEach(([id, subtype]) => {
				assert.ok(subtype.name, `Subtype ${id} should have a name`)
				assert.ok(
					subtype.desc,
					`Subtype ${id} should have a description`,
				)
			})
		})
	})
})
