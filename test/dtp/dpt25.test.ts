/**
 * Validates KNX Data Point Type 25 conversions.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT25 from '../../src/dptlib/dpt25'

describe('DPT25 (double nibble)', () => {
	describe('formatAPDU', () => {
		test('should correctly encode busy/nak nibbles', () => {
			assert.deepEqual(
				DPT25.formatAPDU!({ busy: 0x0a, nak: 0x05 }),
				Buffer.from([0xa5]),
			)
		})

		test('should reject invalid payloads', () => {
			assert.equal(DPT25.formatAPDU!(null as any), null)
			assert.equal(DPT25.formatAPDU!({ busy: -1, nak: 0 }), null)
			assert.equal(DPT25.formatAPDU!({ busy: 0, nak: 16 }), null)
		})
	})

	describe('fromBuffer', () => {
		test('should decode busy/nak nibbles', () => {
			assert.deepEqual(DPT25.fromBuffer!(Buffer.from([0x3c])), {
				busy: 3,
				nak: 12,
			})
		})

		test('should reject invalid buffer lengths', () => {
			assert.equal(DPT25.fromBuffer!(Buffer.from([])), null)
			assert.equal(DPT25.fromBuffer!(Buffer.from([0, 1])), null)
		})
	})
})
