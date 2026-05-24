/**
 * Validates KNX Data Point Type 5 conversions.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { populateAPDU, fromBuffer, resolve, APDU } from '../../src/dptlib'

function encode(value: any, dptid: string): Buffer {
	const apdu = {} as APDU
	populateAPDU(value, apdu, dptid)
	return apdu.data
}

describe('DPT5 (8-bit unsigned value)', () => {
	describe('raw 8-bit (DPT5.004 / DPT5.005 / DPT5.010)', () => {
		test('should encode 0 to 0x00', () => {
			assert.deepEqual(encode(0, '5.004'), Buffer.from([0x00]))
		})

		test('should encode 255 to 0xFF', () => {
			assert.deepEqual(encode(255, '5.004'), Buffer.from([0xff]))
		})

		test('should encode mid-range value', () => {
			assert.deepEqual(encode(128, '5.004'), Buffer.from([0x80]))
		})

		test('round-trip encode/decode', () => {
			for (const v of [0, 1, 64, 128, 200, 255]) {
				const buf = encode(v, '5.004')
				assert.equal(fromBuffer(buf, resolve('5.004')), v, `failed for ${v}`)
			}
		})
	})

	describe('percentage 0–100% (DPT5.001) — scalar range', () => {
		test('should encode 0% to 0x00', () => {
			assert.deepEqual(encode(0, '5.001'), Buffer.from([0x00]))
		})

		test('should encode 100% to 0xFF', () => {
			assert.deepEqual(encode(100, '5.001'), Buffer.from([0xff]))
		})

		test('round-trip boundaries', () => {
			assert.equal(fromBuffer(encode(0, '5.001'), resolve('5.001')), 0)
			assert.equal(fromBuffer(encode(100, '5.001'), resolve('5.001')), 100)
		})

		test('round-trip 50%', () => {
			const decoded = fromBuffer(encode(50, '5.001'), resolve('5.001'))
			assert.ok(
				Math.abs((decoded as number) - 50) <= 1,
				`expected ~50, got ${decoded}`,
			)
		})

		test('raw wire value for 50% is approx 128', () => {
			const buf = encode(50, '5.001')
			assert.ok(buf[0] >= 127 && buf[0] <= 129)
		})
	})

	describe('angle 0–360° (DPT5.003) — scalar range', () => {
		test('should encode 0° to 0x00', () => {
			assert.deepEqual(encode(0, '5.003'), Buffer.from([0x00]))
		})

		test('should encode 360° to 0xFF', () => {
			assert.deepEqual(encode(360, '5.003'), Buffer.from([0xff]))
		})

		test('round-trip boundaries', () => {
			assert.equal(fromBuffer(encode(0, '5.003'), resolve('5.003')), 0)
			assert.equal(fromBuffer(encode(360, '5.003'), resolve('5.003')), 360)
		})
	})

	describe('fromBuffer (generic)', () => {
		test('should return null for empty buffer', () => {
			assert.equal(fromBuffer(Buffer.from([]), resolve('5')), null)
		})

		test('should return null for oversized buffer', () => {
			assert.equal(fromBuffer(Buffer.from([0x00, 0x00]), resolve('5')), null)
		})

		test('should decode raw byte value correctly', () => {
			assert.equal(fromBuffer(Buffer.from([0x00]), resolve('5')), 0)
			assert.equal(fromBuffer(Buffer.from([0xff]), resolve('5')), 255)
			assert.equal(fromBuffer(Buffer.from([0x80]), resolve('5')), 128)
		})
	})
})
