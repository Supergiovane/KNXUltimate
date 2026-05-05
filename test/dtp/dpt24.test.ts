/**
 * Validates KNX Data Point Type 24 conversions.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT24 from '../../src/dptlib/dpt24'

describe('DPT24 (variable-length ISO-8859-1 string)', () => {
	describe('formatAPDU', () => {
		test('should append null terminator when missing', () => {
			assert.deepEqual(
				DPT24.formatAPDU!('KNX'),
				Buffer.from([0x4b, 0x4e, 0x58, 0x00]),
			)
		})

		test('should handle non-string values', () => {
			assert.deepEqual(
				DPT24.formatAPDU!(123),
				Buffer.from('123\0', 'latin1'),
			)
		})
	})

	describe('fromBuffer', () => {
		test('should stop at null terminator', () => {
			assert.equal(
				DPT24.fromBuffer!(Buffer.from([0x41, 0x42, 0x00, 0x43])),
				'AB',
			)
		})

		test('should decode full buffer when no terminator is present', () => {
			assert.equal(
				DPT24.fromBuffer!(Buffer.from('Hello', 'latin1')),
				'Hello',
			)
		})

		test('should reject empty buffers', () => {
			assert.equal(DPT24.fromBuffer!(Buffer.from([])), null)
		})
	})
})
