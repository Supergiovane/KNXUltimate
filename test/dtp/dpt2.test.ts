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

	describe('basetype', () => {
		test('should have correct properties', () => {
			assert.strictEqual(DPT2.basetype.bitlength, 2)
			assert.strictEqual(DPT2.basetype.valuetype, 'composite')
			assert.strictEqual(DPT2.basetype.desc, '1-bit value with priority')
			assert.ok(DPT2.basetype.help.includes('priority'))
			assert.ok(DPT2.basetype.helplink.includes('Sample---DPT2'))
		})
	})

	describe('subtypes', () => {
		test('should have correct switch control (001) subtype', () => {
			const switchControl = DPT2.subtypes['001']
			assert.strictEqual(switchControl.name, 'Switch control')
			assert.strictEqual(switchControl.use, 'G')
			assert.deepEqual(switchControl.enc, { 0: 'Off', 1: 'On' })
		})

		test('should have correct boolean control (002) subtype', () => {
			const boolControl = DPT2.subtypes['002']
			assert.strictEqual(boolControl.name, 'Bool control')
			assert.strictEqual(boolControl.use, 'G')
			assert.deepEqual(boolControl.enc, { 0: 'false', 1: 'true' })
		})

		test('should have correct alarm control (005) subtype', () => {
			const alarmControl = DPT2.subtypes['005']
			assert.strictEqual(alarmControl.name, 'Alarm control')
			assert.strictEqual(alarmControl.use, 'FB')
			assert.deepEqual(alarmControl.enc, { 0: 'No alarm', 1: 'Alarm' })
		})

		test('should have correct state control (011) subtype', () => {
			const stateControl = DPT2.subtypes['011']
			assert.strictEqual(stateControl.name, 'State control')
			assert.strictEqual(stateControl.use, 'FB')
			assert.deepEqual(stateControl.enc, {
				0: 'No control',
				1: 'No control',
				2: 'Off',
				3: 'On',
			})
		})

		test('should verify all subtypes have required properties', () => {
			Object.entries(DPT2.subtypes).forEach(([id, subtype]) => {
				assert.ok(subtype.name, `Subtype ${id} should have a name`)
				assert.ok(
					subtype.use,
					`Subtype ${id} should have a use property`,
				)
				assert.ok(
					subtype.desc,
					`Subtype ${id} should have a description`,
				)
				assert.ok(subtype.enc, `Subtype ${id} should have encodings`)
			})
		})
	})
})
