/**
 * Validates KNX Data Point Type 13 conversions.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { populateAPDU, fromBuffer, resolve, APDU } from '../../src/dptlib'

function encode(value: number, dptid = '13'): Buffer {
	const apdu = {} as APDU
	populateAPDU(value, apdu, dptid)
	return apdu.data
}

describe('DPT13 (4-byte signed value)', () => {
	describe('formatAPDU (generic)', () => {
		test('should encode 0 to 4 zero bytes', () => {
			assert.deepEqual(encode(0), Buffer.from([0x00, 0x00, 0x00, 0x00]))
		})

		test('should encode 1 to 0x00000001', () => {
			assert.deepEqual(encode(1), Buffer.from([0x00, 0x00, 0x00, 0x01]))
		})

		test('should encode max positive (2^31 - 1) to 0x7FFFFFFF', () => {
			assert.deepEqual(
				encode(2147483647),
				Buffer.from([0x7f, 0xff, 0xff, 0xff]),
			)
		})

		test('should encode -1 to 0xFFFFFFFF', () => {
			assert.deepEqual(
				encode(-1),
				Buffer.from([0xff, 0xff, 0xff, 0xff]),
			)
		})

		test('should encode min negative (-2^31) to 0x80000000', () => {
			assert.deepEqual(
				encode(-2147483648),
				Buffer.from([0x80, 0x00, 0x00, 0x00]),
			)
		})

		test('should encode 1000 (Wh) to 0x000003E8', () => {
			assert.deepEqual(
				encode(1000),
				Buffer.from([0x00, 0x00, 0x03, 0xe8]),
			)
		})

		test('should produce 4-byte buffer', () => {
			assert.equal(encode(42).length, 4)
		})
	})

	describe('fromBuffer (generic)', () => {
		test('should decode 0x00000000 to 0', () => {
			assert.equal(
				fromBuffer(Buffer.from([0x00, 0x00, 0x00, 0x00]), resolve('13')),
				0,
			)
		})

		test('should decode 0x7FFFFFFF to 2147483647', () => {
			assert.equal(
				fromBuffer(Buffer.from([0x7f, 0xff, 0xff, 0xff]), resolve('13')),
				2147483647,
			)
		})

		test('should decode 0xFFFFFFFF to -1', () => {
			assert.equal(
				fromBuffer(Buffer.from([0xff, 0xff, 0xff, 0xff]), resolve('13')),
				-1,
			)
		})

		test('should decode 0x80000000 to -2147483648', () => {
			assert.equal(
				fromBuffer(Buffer.from([0x80, 0x00, 0x00, 0x00]), resolve('13')),
				-2147483648,
			)
		})

		test('should return null for wrong buffer length', () => {
			assert.equal(fromBuffer(Buffer.from([]), resolve('13')), null)
			assert.equal(fromBuffer(Buffer.from([0x00, 0x00, 0x00]), resolve('13')), null)
			assert.equal(
				fromBuffer(Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00]), resolve('13')),
				null,
			)
		})
	})

	describe('round-trip encode/decode', () => {
		const values = [-2147483648, -1000000, -1, 0, 1, 1000, 2147483647]
		for (const v of values) {
			test(`round-trip ${v}`, () => {
				assert.equal(fromBuffer(encode(v), resolve('13')), v)
			})
		}
	})

	describe('DPT13.010 (active energy Wh)', () => {
		test('round-trip real energy reading', () => {
			const apdu = {} as APDU
			populateAPDU(123456, apdu, '13.010')
			assert.equal(fromBuffer(apdu.data, resolve('13.010')), 123456)
		})

		test('round-trip negative energy (export)', () => {
			const apdu = {} as APDU
			populateAPDU(-5000, apdu, '13.010')
			assert.equal(fromBuffer(apdu.data, resolve('13.010')), -5000)
		})
	})
})
