/**
 * Validates KNX Data Point Type 237 conversions.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT237 from '../../src/dptlib/dpt237'

describe('DPT237 (DALI Control Gear Diagnostic)', () => {
	describe('formatAPDU', () => {
		test('should correctly format valid diagnostic data', () => {
			const value = {
				readResponse: false,
				addressIndicator: false,
				daliAddress: 8,
				lampFailure: false,
				ballastFailure: false,
				convertorError: false,
			}

			const result = DPT237.formatAPDU(value)
			assert.ok(Buffer.isBuffer(result))
			assert.equal(result.length, 2)
			assert.deepEqual(result, Buffer.from([0b00000000, 0b00001000]))
		})

		test('should handle all true values', () => {
			const value = {
				readResponse: true,
				addressIndicator: true,
				daliAddress: 63,
				lampFailure: true,
				ballastFailure: true,
				convertorError: true,
			}

			const result = DPT237.formatAPDU(value)
			assert.ok(Buffer.isBuffer(result))
			assert.equal(result.length, 2)
			assert.deepEqual(result, Buffer.from([0b00000111, 0b11111111]))
		})

		test('should handle edge case dali addresses', () => {
			// Test minimum dali address
			const minValue = {
				readResponse: false,
				addressIndicator: false,
				daliAddress: 0,
				lampFailure: false,
				ballastFailure: false,
				convertorError: false,
			}
			const minResult = DPT237.formatAPDU(minValue)
			assert.deepEqual(minResult, Buffer.from([0b00000000, 0b00000000]))

			// Test maximum dali address
			const maxValue = {
				readResponse: false,
				addressIndicator: false,
				daliAddress: 64,
				lampFailure: false,
				ballastFailure: false,
				convertorError: false,
			}
			const maxResult = DPT237.formatAPDU(maxValue)
			assert.ok(Buffer.isBuffer(maxResult))
			assert.equal(maxResult.length, 2)
		})
	})

	describe('fromBuffer', () => {
		test('should correctly parse valid buffers', () => {
			// Test all flags false, address 8
			const result1 = DPT237.fromBuffer(
				Buffer.from([0b00000000, 0b00001000]),
			)
			assert.deepEqual(result1, {
				readResponse: false,
				addressIndicator: false,
				daliAddress: 8,
				lampFailure: false,
				ballastFailure: false,
				convertorError: false,
			})

			// Test all flags true, max address
			const result2 = DPT237.fromBuffer(
				Buffer.from([0b00000111, 0b11111111]),
			)
			assert.deepEqual(result2, {
				readResponse: true,
				addressIndicator: true,
				daliAddress: 63,
				lampFailure: true,
				ballastFailure: true,
				convertorError: true,
			})
		})

		test('should handle mixed flag states', () => {
			const result = DPT237.fromBuffer(
				Buffer.from([0b00000101, 0b10100110]),
			)
			assert.deepEqual(result, {
				readResponse: true,
				addressIndicator: false,
				daliAddress: 38,
				lampFailure: true,
				ballastFailure: false,
				convertorError: true,
			})
		})

		test('should handle invalid buffer lengths', () => {
			// Test buffer too short
			assert.strictEqual(DPT237.fromBuffer(Buffer.from([0x00])), null)

			// Test buffer too long
			assert.strictEqual(
				DPT237.fromBuffer(Buffer.from([0x00, 0x00, 0x00])),
				null,
			)

			// Test empty buffer
			assert.strictEqual(DPT237.fromBuffer(Buffer.from([])), null)
		})
	})

	describe('Helper functions behavior', () => {
		test('should correctly convert between binary representations', () => {
			// Test hex2bin function through fromBuffer
			const hexResult = DPT237.fromBuffer(Buffer.from([0xff, 0xff]))
			assert.equal(hexResult.lampFailure, true)
			assert.equal(hexResult.ballastFailure, true)
			assert.equal(hexResult.convertorError, true)

			// Test dec2bin function through formatAPDU
			const testValue = {
				readResponse: false,
				addressIndicator: false,
				daliAddress: 42,
				lampFailure: false,
				ballastFailure: false,
				convertorError: false,
			}
			const decResult = DPT237.formatAPDU(testValue)
			assert.deepEqual(decResult, Buffer.from([0b00000000, 0b00101010]))
		})
	})
})
