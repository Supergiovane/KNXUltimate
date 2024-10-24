import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT1 from '../../src/dptlib/dpt1'

describe('DPT1 (1-bit value)', () => {
	describe('formatAPDU', () => {
		test('should handle numeric values', () => {
			// Zero should be converted to 0
			assert.deepEqual(DPT1.formatAPDU(0), Buffer.from([0]))
			assert.deepEqual(DPT1.formatAPDU('0'), Buffer.from([0]))

			// Any non-zero number should be converted to 1
			assert.deepEqual(DPT1.formatAPDU(1), Buffer.from([1]))
			assert.deepEqual(DPT1.formatAPDU('1'), Buffer.from([1]))
			assert.deepEqual(DPT1.formatAPDU(42), Buffer.from([1]))
			assert.deepEqual(DPT1.formatAPDU('42'), Buffer.from([1]))
		})

		test('should handle boolean values', () => {
			assert.deepEqual(DPT1.formatAPDU(true), Buffer.from([1]))
			assert.deepEqual(DPT1.formatAPDU(false), Buffer.from([0]))
			assert.deepEqual(DPT1.formatAPDU('true'), Buffer.from([1]))
			assert.deepEqual(DPT1.formatAPDU('false'), Buffer.from([0]))
		})
	})

	describe('fromBuffer', () => {
		test('should correctly convert buffer to boolean', () => {
			assert.strictEqual(DPT1.fromBuffer(Buffer.from([0])), false)
			assert.strictEqual(DPT1.fromBuffer(Buffer.from([1])), true)
			assert.strictEqual(DPT1.fromBuffer(Buffer.from([255])), true)
		})

		test('should return null for invalid buffer length', () => {
			assert.strictEqual(DPT1.fromBuffer(Buffer.from([])), null)
			assert.strictEqual(DPT1.fromBuffer(Buffer.from([0, 1])), null)
		})
	})

	describe('basetype', () => {
		test('should have correct properties', () => {
			assert.strictEqual(DPT1.basetype.bitlength, 1)
			assert.strictEqual(DPT1.basetype.valuetype, 'basic')
			assert.strictEqual(DPT1.basetype.desc, '1-bit value')
		})
	})

	describe('subtypes', () => {
		test('should have correct switch (001) subtype', () => {
			const switchType = DPT1.subtypes['001']
			assert.strictEqual(switchType.name, 'Switch')
			assert.deepEqual(switchType.enc, { 0: 'Off', 1: 'On' })
			assert.strictEqual(switchType.use, 'G')
		})

		test('should have correct boolean (002) subtype', () => {
			const boolType = DPT1.subtypes['002']
			assert.strictEqual(boolType.name, 'Boolean')
			assert.deepEqual(boolType.enc, { 0: 'false', 1: 'true' })
			assert.strictEqual(boolType.use, 'G')
		})

		test('should have correct alarm (005) subtype', () => {
			const alarmType = DPT1.subtypes['005']
			assert.strictEqual(alarmType.name, 'Alarm')
			assert.deepEqual(alarmType.enc, { 0: 'No alarm', 1: 'Alarm' })
			assert.strictEqual(alarmType.use, 'FB')
		})

		test('should have correct window/door (019) subtype', () => {
			const windowDoorType = DPT1.subtypes['019']
			assert.strictEqual(windowDoorType.name, 'Window/Door')
			assert.deepEqual(windowDoorType.enc, { 0: 'closed', 1: 'open' })
			assert.strictEqual(windowDoorType.use, 'G')
		})
	})
})
