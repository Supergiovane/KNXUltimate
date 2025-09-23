/**
 * Validates KNX Data Point Type 14 conversions.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT14 from '../../src/dptlib/dpt14'

const assertFloatEqual = (actual: number, expected: number, epsilon = 0.01) => {
	const diff = Math.abs(actual - expected)
	assert.ok(
		diff < epsilon,
		`Expected ${actual} to be close to ${expected} (diff: ${diff})`,
	)
}

describe('DPT14 (32-bit floating point value)', () => {
	describe('formatAPDU', () => {
		test('should correctly format standard float values', () => {
			// Test standard values
			let buffer = DPT14.formatAPDU(42.0)
			assert.ok(buffer)
			assert.equal(buffer.length, 4)
			assertFloatEqual(buffer.readFloatBE(0), 42.0)

			buffer = DPT14.formatAPDU(3.14159)
			assert.ok(buffer)
			assert.equal(buffer.length, 4)
			assertFloatEqual(buffer.readFloatBE(0), 3.14159)

			buffer = DPT14.formatAPDU(-273.15)
			assert.ok(buffer)
			assert.equal(buffer.length, 4)
			assertFloatEqual(buffer.readFloatBE(0), -273.15)
		})

		test('should handle special numeric values', () => {
			// Test zero
			let buffer = DPT14.formatAPDU(0)
			assert.ok(buffer)
			assert.equal(buffer.length, 4)
			assert.equal(buffer.readFloatBE(0), 0)

			// Test very large numbers
			buffer = DPT14.formatAPDU(3.4e38) // Close to max float32
			assert.ok(buffer)
			assert.equal(buffer.length, 4)
			assert.ok(buffer.readFloatBE(0) > 3e38)

			// Test very small numbers
			buffer = DPT14.formatAPDU(1.18e-38) // Close to min float32
			assert.ok(buffer)
			assert.equal(buffer.length, 4)
			assert.ok(buffer.readFloatBE(0) < 1.19e-38)
		})

		test('should handle invalid inputs by returning zero', () => {
			// Test null
			let buffer = DPT14.formatAPDU(null)
			assert.ok(buffer)
			assert.equal(buffer.length, 4)
			assert.equal(buffer.readFloatBE(0), 0)

			// Test undefined
			buffer = DPT14.formatAPDU(undefined)
			assert.ok(buffer)
			assert.equal(buffer.length, 4)
			assert.equal(buffer.readFloatBE(0), 0)

			// Test non-numeric values
			buffer = DPT14.formatAPDU('42' as any)
			assert.ok(buffer)
			assert.equal(buffer.length, 4)
			assert.equal(buffer.readFloatBE(0), 0)
		})
	})

	describe('fromBuffer', () => {
		test('should correctly parse valid buffers', () => {
			const buffer = Buffer.alloc(4)

			buffer.writeFloatBE(42.0, 0)
			assertFloatEqual(DPT14.fromBuffer(buffer), 42.0)

			buffer.writeFloatBE(3.14159, 0)
			assertFloatEqual(DPT14.fromBuffer(buffer), 3.14159)

			buffer.writeFloatBE(-273.15, 0)
			assertFloatEqual(DPT14.fromBuffer(buffer), -273.15)
		})

		test('should handle special numeric values in buffer', () => {
			const buffer = Buffer.alloc(4)

			// Test zero
			buffer.writeFloatBE(0, 0)
			assert.equal(DPT14.fromBuffer(buffer), 0)

			// Test very large numbers
			buffer.writeFloatBE(3.4e38, 0)
			const largeNum = DPT14.fromBuffer(buffer)
			assert.ok(largeNum > 3e38)

			// Test very small numbers
			buffer.writeFloatBE(1.18e-38, 0)
			const smallNum = DPT14.fromBuffer(buffer)
			assert.ok(smallNum < 1.19e-38)
		})

		test('should handle invalid buffer lengths', () => {
			// Empty buffer
			assert.strictEqual(DPT14.fromBuffer(Buffer.alloc(0)), null)

			// Buffer too short
			assert.strictEqual(DPT14.fromBuffer(Buffer.alloc(3)), null)

			// Buffer too long
			assert.strictEqual(DPT14.fromBuffer(Buffer.alloc(5)), null)
		})
	})
})
