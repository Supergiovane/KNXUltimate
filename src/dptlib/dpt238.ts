/**
 * Provides KNX Data Point Type 238 encoding and decoding helpers.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

/**
 * KNXEngine - a KNX protocol stack in Javascript
 * (C) 2020-2022 Supergiovane
 */

import { module } from '../KnxLog'
import type { DatapointConfig, FromBufferContext } from '.'

//
// DPT238: 1-byte unsigned value
//
// DPT5 is the only (AFAIK) DPT with scalar datatypes (5.001 and 5.003)

const logger = module('DPT238')

// DPT 238.600 DPT_DALI_Control_Gear_Diagnostic (03.07.02 §6.8.1), as XKNX:
// b7 ballast failure, b6 lamp failure, b5..b0 DALI device address
const isDaliDiagnostic = (context?: FromBufferContext) =>
	context?.strict === true && context.subtypeid === '600'

const config: DatapointConfig = {
	id: 'DPT238',
	formatAPDU: (value, context) => {
		const apdu_data = Buffer.alloc(1)
		if (isDaliDiagnostic(context)) {
			if (
				typeof value !== 'object' ||
				value === null ||
				!Number.isInteger(value.address) ||
				value.address < 0 ||
				value.address > 63
			) {
				throw new Error(
					'Must supply an object of {address: 0..63, lampFailure, ballastFailure}',
				)
			}
			apdu_data[0] =
				(value.ballastFailure ? 0x80 : 0) |
				(value.lampFailure ? 0x40 : 0) |
				value.address
			return apdu_data
		}
		if (
			context?.strict &&
			(!Number.isInteger(value) || value < 0 || value > 255)
		) {
			throw new Error(`value ${value} out of range [0, 255]`)
		}
		apdu_data[0] = value
		logger.debug(`input value = ${value}   apdu_data = ${apdu_data}`)
		return apdu_data
	},

	fromBuffer: (buf, context) => {
		if (buf.length !== 1) {
			logger.debug('Buffer should be 1 byte long, got', buf.length)
			return null
		}
		if (isDaliDiagnostic(context)) {
			return {
				address: buf[0] & 0x3f,
				lampFailure: (buf[0] & 0x40) !== 0,
				ballastFailure: (buf[0] & 0x80) !== 0,
			}
		}
		const ret = buf[0]
		return ret
	},

	basetype: {
		bitlength: 8,
		range: [,],
		valuetype: 'basic',
		desc: '1-byte',
	},

	subtypes: {
		// 20.102 HVAC mode
		102: {
			name: 'HVAC_Mode',
			desc: '',
			unit: '',
			scalar_range: [,],
			range: [,],
		},

		// 5.003 angle (degrees 0=0, ff=360)
		'003': {
			desc: 'Angle',
			name: 'Angle degrees',
			unit: '°',
			scalar_range: [0, 360],
		},

		// 5.004 percentage (0..255%)
		'004': {
			desc: 'Percent_U8',
			name: 'Percent',
			unit: '%',
		},

		// 5.005 ratio (0..255)
		'005': {
			desc: 'DecimalFactor',
			name: 'Ratio',
			unit: 'ratio',
		},

		// 5.006 tariff (0..255)
		'006': {
			desc: 'Tariff',
			name: 'Tariff',
			unit: 'tariff',
		},

		// 5.010 counter pulses (0..255)
		'010': {
			desc: 'Value_1_Ucount',
			name: 'Counter pulses',
			unit: 'pulses',
		},

		// 238.600 DALI control gear diagnostic (fields only in strict mode)
		600: {
			desc: 'DPT_DALI_Control_Gear_Diagnostic',
			name: 'DALI Control Gear Diagnostic',
		},
	},
}

export default config
