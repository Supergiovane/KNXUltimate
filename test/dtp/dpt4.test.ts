/**
 * Validates KNX Data Point Type 4 conversions.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT4 from '../../src/dptlib/dpt4'

describe('DPT4 (8-bit character)', () => {
	describe('formatAPDU', () => {
		test('should correctly format valid ASCII characters', () => {
			// Basic ASCII characters
			assert.deepEqual(DPT4.formatAPDU('A'), Buffer.from([65]))
			assert.deepEqual(DPT4.formatAPDU('Z'), Buffer.from([90]))
			assert.deepEqual(DPT4.formatAPDU('1'), Buffer.from([49]))
			assert.deepEqual(DPT4.formatAPDU(' '), Buffer.from([32]))

			// Control characters
			assert.deepEqual(DPT4.formatAPDU('\r'), Buffer.from([13]))
			assert.deepEqual(DPT4.formatAPDU('\n'), Buffer.from([10]))

			// Take first character of longer strings
			assert.deepEqual(DPT4.formatAPDU('Hello'), Buffer.from([72]))
			assert.deepEqual(DPT4.formatAPDU('Test String'), Buffer.from([84]))
		})

		test('should handle invalid inputs', () => {
			// Null and undefined
			assert.strictEqual(DPT4.formatAPDU(null), null)
			assert.strictEqual(DPT4.formatAPDU(undefined), null)

			// Non-string values
			assert.strictEqual(DPT4.formatAPDU(123 as any), null)
			assert.strictEqual(DPT4.formatAPDU({} as any), null)
			assert.strictEqual(DPT4.formatAPDU([] as any), null)
			assert.strictEqual(DPT4.formatAPDU(true as any), null)
		})
	})

	describe('fromBuffer', () => {
		test('should correctly parse valid buffers', () => {
			// Basic ASCII characters
			assert.equal(DPT4.fromBuffer(Buffer.from([65])), 'A')
			assert.equal(DPT4.fromBuffer(Buffer.from([90])), 'Z')
			assert.equal(DPT4.fromBuffer(Buffer.from([49])), '1')
			assert.equal(DPT4.fromBuffer(Buffer.from([32])), ' ')

			// Control characters
			assert.equal(DPT4.fromBuffer(Buffer.from([13])), '\r')
			assert.equal(DPT4.fromBuffer(Buffer.from([10])), '\n')
		})

		test('should handle invalid buffer lengths', () => {
			// Empty buffer
			assert.strictEqual(DPT4.fromBuffer(Buffer.from([])), null)

			// Buffer too long
			assert.strictEqual(DPT4.fromBuffer(Buffer.from([65, 66])), null)
			assert.strictEqual(DPT4.fromBuffer(Buffer.from([65, 66, 67])), null)
		})
	})
})
