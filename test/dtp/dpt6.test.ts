/**
 * Validates KNX Data Point Type 6 conversions.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { populateAPDU, fromBuffer, resolve, APDU } from '../../src/dptlib'

function encode(value: number, dptid = '6'): Buffer {
	const apdu = {} as APDU
	populateAPDU(value, apdu, dptid)
	return apdu.data
}

describe('DPT6 (8-bit signed value)', () => {
	describe('formatAPDU (generic)', () => {
		test('should encode 0 to 0x00', () => {
			assert.deepEqual(encode(0), Buffer.from([0x00]))
		})

		test('should encode positive value 1 to 0x01', () => {
			assert.deepEqual(encode(1), Buffer.from([0x01]))
		})

		test('should encode max positive 127 to 0x7F', () => {
			assert.deepEqual(encode(127), Buffer.from([0x7f]))
		})

		test('should encode -1 to 0xFF (two\'s complement)', () => {
			assert.deepEqual(encode(-1), Buffer.from([0xff]))
		})

		test('should encode min negative -128 to 0x80', () => {
			assert.deepEqual(encode(-128), Buffer.from([0x80]))
		})

		test('should produce 1-byte buffer', () => {
			assert.equal(encode(42).length, 1)
		})
	})

	describe('fromBuffer (generic)', () => {
		test('should decode 0x00 to 0', () => {
			assert.equal(fromBuffer(Buffer.from([0x00]), resolve('6')), 0)
		})

		test('should decode 0x01 to 1', () => {
			assert.equal(fromBuffer(Buffer.from([0x01]), resolve('6')), 1)
		})

		test('should decode 0x7F to 127', () => {
			assert.equal(fromBuffer(Buffer.from([0x7f]), resolve('6')), 127)
		})

		test('should decode 0xFF to -1', () => {
			assert.equal(fromBuffer(Buffer.from([0xff]), resolve('6')), -1)
		})

		test('should decode 0x80 to -128', () => {
			assert.equal(fromBuffer(Buffer.from([0x80]), resolve('6')), -128)
		})

		test('should return null for empty buffer', () => {
			assert.equal(fromBuffer(Buffer.from([]), resolve('6')), null)
		})

		test('should return null for oversized buffer', () => {
			assert.equal(fromBuffer(Buffer.from([0x00, 0x01]), resolve('6')), null)
		})
	})

	describe('round-trip encode/decode', () => {
		const values = [-128, -100, -1, 0, 1, 50, 127]
		for (const v of values) {
			test(`round-trip ${v}`, () => {
				const buf = encode(v)
				assert.equal(fromBuffer(buf, resolve('6')), v)
			})
		}
	})

	describe('DPT6.001 (percent -128..127%)', () => {
		test('round-trip via subtype', () => {
			const apdu = {} as APDU
			populateAPDU(-24, apdu, '6.001')
			assert.equal(fromBuffer(apdu.data, resolve('6.001')), -24)
		})
	})
})
