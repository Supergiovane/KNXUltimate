/**
 * Validates the opt-in strict Datapoint Types mode (03.07.02) of dptlib,
 * and that the legacy behaviour is unchanged when it is off.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { APDU, fromBuffer, populateAPDU, resolve } from '../../src/dptlib'

const encode = (value: any, dpt: string, strict?: boolean) => {
	const apdu = {} as APDU
	populateAPDU(
		value,
		apdu,
		dpt,
		strict === undefined ? undefined : { strict },
	)
	return apdu.data == null ? null : apdu.data.toString('hex')
}

const decode = (hex: string, dpt: string, strict?: boolean) =>
	fromBuffer(
		Buffer.from(hex, 'hex'),
		resolve(dpt),
		strict === undefined ? undefined : { strict },
	)

describe('dptlib strict mode', () => {
	describe('encode, legacy behaviour unchanged', () => {
		const legacy: [string, any, string | null][] = [
			['DPT5.001', 128, '80'],
			['DPT5.001', 101, '65'],
			['DPT7.001', -5, '0000'],
			['DPT7.001', 70000, 'ffff'],
			['DPT9.001', 700000, '7ffe'],
			['DPT20.102', 300, '2c'],
			['DPT18.001', 5, null],
			['DPT21.102', 3, null],
		]
		legacy.forEach(([dpt, value, hex]) => {
			test(`${dpt} ${value} -> ${hex}`, () => {
				assert.equal(encode(value, dpt), hex)
				assert.equal(encode(value, dpt, false), hex)
			})
		})
	})

	describe('encode, strict', () => {
		const rejected: [string, any][] = [
			['DPT5.001', 128],
			['DPT5.001', 101],
			['DPT5.001', -1],
			['DPT5.003', 361],
			['DPT6.010', 200],
			['DPT7.001', -5],
			['DPT7.001', 70000],
			['DPT9.001', 700000],
			['DPT9.001', 3.4e38],
			['DPT9.001', NaN],
			['DPT9', 670433.29],
			['DPT9', -671088.65],
			['DPT20.102', 300],
			['DPT20.102', 5],
			['DPT20.007', 0],
			['DPT20.102', 1.5],
			['DPT18.001', 5],
			['DPT2.001', 1],
			['DPT21.102', 3],
			['DPT21.102', { fault: 1 }],
			['DPT238', 256],
			['DPT238.600', 5],
			['DPT238.600', { address: 64 }],
		]
		rejected.forEach(([dpt, value]) => {
			test(`${dpt} ${JSON.stringify(value) ?? value} throws`, () => {
				assert.throws(() => encode(value, dpt, true))
			})
		})

		const accepted: [string, any, string][] = [
			['DPT5.001', 100, 'ff'],
			['DPT5.001', 0, '00'],
			['DPT7.001', 65535, 'ffff'],
			['DPT9.001', 21.5, '0c33'],
			['DPT9', 670433.28, '7ffe'],
			['DPT9', -671088.64, 'f800'],
			['DPT20.102', 4, '04'],
			['DPT20.007', 3, '03'],
			['DPT1.001', true, '01'],
			['DPT14', 1.5, '3fc00000'],
			['DPT4.001', 'A', '41'],
			// 21.102 DPT_StatusRHC: b0 fault ... b7 summer mode
			['DPT21.102', { fault: true, summerMode: true }, '81'],
			['DPT21.102', { statusEco: true, tempReturnLimit: true }, '0a'],
			// 238.600: b7 ballast failure, b6 lamp failure, b5..b0 address
			['DPT238.600', { address: 5, lampFailure: true }, '45'],
			[
				'DPT238.600',
				{ address: 63, lampFailure: true, ballastFailure: true },
				'ff',
			],
		]
		accepted.forEach(([dpt, value, hex]) => {
			test(`${dpt} ${JSON.stringify(value)} -> ${hex}`, () => {
				assert.equal(encode(value, dpt, true), hex)
			})
		})
	})

	describe('decode', () => {
		test('21.102 uses the DPT_StatusRHC fields only in strict mode', () => {
			assert.deepEqual(decode('01', 'DPT21.102'), {
				outOfService: true,
				fault: false,
				overridden: false,
				inAlarm: false,
				alarmUnAck: false,
			})
			assert.deepEqual(decode('83', 'DPT21.102', true), {
				fault: true,
				statusEco: true,
				tempFlowLimit: false,
				tempReturnLimit: false,
				statusMorningBoost: false,
				statusStartOptim: false,
				statusStopOptim: false,
				summerMode: true,
			})
			// 21.001 keeps its fields in strict mode
			assert.equal(decode('01', 'DPT21.001', true).outOfService, true)
		})

		test('DPT 9 7FFFh is invalid data only in strict mode', () => {
			assert.equal(decode('7fff', 'DPT9.001'), 670760.96)
			assert.equal(decode('7fff', 'DPT9.001', true), null)
			assert.equal(decode('7ffe', 'DPT9.001', true), 670433.28)
		})

		test('reserved DPT 20 enumeration values are null only in strict mode', () => {
			const cases: [string, string, number, number | null][] = [
				['DPT20.102', 'ff', 255, null],
				['DPT20.102', '05', 5, null],
				['DPT20.102', '04', 4, 4],
				['DPT20.007', '00', 0, null],
				['DPT20.007', '04', 4, null],
				['DPT20.007', '01', 1, 1],
				['DPT20.107', '03', 3, null],
				['DPT20.107', '02', 2, 2],
				['DPT20', 'ff', 255, 255],
			]
			cases.forEach(([dpt, hex, legacy, strict]) => {
				assert.equal(decode(hex, dpt), legacy, dpt)
				assert.equal(decode(hex, dpt, true), strict, dpt)
			})
		})

		test('238.600 has a subtype and decodes its fields only in strict mode', () => {
			assert.equal(
				resolve('DPT238.600').subtype?.desc,
				'DPT_DALI_Control_Gear_Diagnostic',
			)
			assert.equal(decode('c5', 'DPT238.600'), 0xc5)
			assert.deepEqual(decode('c5', 'DPT238.600', true), {
				address: 5,
				lampFailure: true,
				ballastFailure: true,
			})
			assert.equal(decode('c5', 'DPT238', true), 0xc5)
		})
	})
})
