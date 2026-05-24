/**
 * Validates KNX Data Point Type 8 conversions.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { populateAPDU, fromBuffer, resolve, APDU } from '../../src/dptlib'

function encode(value: number, dptid = '8'): Buffer {
	const apdu = {} as APDU
	populateAPDU(value, apdu, dptid)
	return apdu.data
}

describe('DPT8 (16-bit signed value)', () => {
	describe('formatAPDU (generic)', () => {
		test('should encode 0 to 0x0000', () => {
			assert.deepEqual(encode(0), Buffer.from([0x00, 0x00]))
		})

		test('should encode 1 to 0x0001', () => {
			assert.deepEqual(encode(1), Buffer.from([0x00, 0x01]))
		})

		test('should encode max positive 32767 to 0x7FFF', () => {
			assert.deepEqual(encode(32767), Buffer.from([0x7f, 0xff]))
		})

		test('should encode -1 to 0xFFFF (two\'s complement)', () => {
			assert.deepEqual(encode(-1), Buffer.from([0xff, 0xff]))
		})

		test('should encode min negative -32768 to 0x8000', () => {
			assert.deepEqual(encode(-32768), Buffer.from([0x80, 0x00]))
		})

		test('should encode 1000 to 0x03E8', () => {
			assert.deepEqual(encode(1000), Buffer.from([0x03, 0xe8]))
		})

		test('should produce 2-byte buffer', () => {
			assert.equal(encode(42).length, 2)
		})
	})

	describe('fromBuffer (generic)', () => {
		test('should decode 0x0000 to 0', () => {
			assert.equal(fromBuffer(Buffer.from([0x00, 0x00]), resolve('8')), 0)
		})

		test('should decode 0x7FFF to 32767', () => {
			assert.equal(
				fromBuffer(Buffer.from([0x7f, 0xff]), resolve('8')),
				32767,
			)
		})

		test('should decode 0xFFFF to -1', () => {
			assert.equal(
				fromBuffer(Buffer.from([0xff, 0xff]), resolve('8')),
				-1,
			)
		})

		test('should decode 0x8000 to -32768', () => {
			assert.equal(
				fromBuffer(Buffer.from([0x80, 0x00]), resolve('8')),
				-32768,
			)
		})

		test('should return null for empty buffer', () => {
			assert.equal(fromBuffer(Buffer.from([]), resolve('8')), null)
		})

		test('should return null for 1-byte buffer', () => {
			assert.equal(fromBuffer(Buffer.from([0x00]), resolve('8')), null)
		})

		test('should return null for oversized buffer', () => {
			assert.equal(
				fromBuffer(Buffer.from([0x00, 0x00, 0x00]), resolve('8')),
				null,
			)
		})
	})

	describe('round-trip encode/decode', () => {
		const values = [-32768, -1000, -1, 0, 1, 1200, 32767]
		for (const v of values) {
			test(`round-trip ${v}`, () => {
				assert.equal(fromBuffer(encode(v), resolve('8')), v)
			})
		}
	})

	describe('DPT8.010 (percentage difference)', () => {
		test('round-trip via subtype', () => {
			const apdu = {} as APDU
			populateAPDU(-50, apdu, '8.010')
			assert.equal(fromBuffer(apdu.data, resolve('8.010')), -50)
		})
	})
})
