/**
 * Provides KNX Data Point Type 14 encoding and decoding helpers.
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

import type { DatapointConfig } from '.'
import { module } from '../KnxLog'

//
// DPT14.*: 4-byte floating point value
//

/* In sharp contrast to DPT9 (16-bit floating point - JS spec does not support),
 *  the case for 32-bit floating point is simple...
 */

const logger = module('DPT14')
const MAX_FLOAT32 = 3.4028234663852886e38

function isDebugEnabled(): boolean {
	if (typeof logger.isLevelEnabled === 'function') {
		return logger.isLevelEnabled('debug')
	}
	return logger.level === 'debug'
}

function errorDebugOnly(message: string, ...args: unknown[]): void {
	if (isDebugEnabled()) logger.error(message, ...args)
}

function warnDebugOnly(message: string, ...args: unknown[]): void {
	if (isDebugEnabled()) logger.warn(message, ...args)
}

const config: DatapointConfig = {
	id: 'DPT14',
	formatAPDU: (value, context) => {
		const logSuffix = context?.logSuffix || ''
		const inputType = typeof value
		let normalizedValue = value

		if (inputType !== 'number' || !Number.isFinite(value)) {
			errorDebugOnly(
				`Must supply a finite number value. Will emit 0${logSuffix}`,
			)
			logger.debug(
				`formatAPDU invalid input: input=%j inputType=%s finite=%s${logSuffix}`,
				value,
				inputType,
				Number.isFinite(value),
			)
			normalizedValue = 0
		}

		if (normalizedValue > MAX_FLOAT32 || normalizedValue < -MAX_FLOAT32) {
			const clampedValue =
				normalizedValue > 0 ? MAX_FLOAT32 : -MAX_FLOAT32
			errorDebugOnly(
				`Value out of float32 range (${normalizedValue}). Clamping to ${clampedValue}${logSuffix}`,
			)
			logger.debug(
				`formatAPDU range clamp: input=%j normalized=%d clamped=%d max=%d${logSuffix}`,
				value,
				normalizedValue,
				clampedValue,
				MAX_FLOAT32,
			)
			normalizedValue = clampedValue
		}

		const apdu_data = Buffer.alloc(4)
		apdu_data.writeFloatBE(normalizedValue, 0)
		logger.debug(
			`formatAPDU encoded: input=%j normalized=%d apdu=${apdu_data.toString('hex')}${logSuffix}`,
			value,
			normalizedValue,
		)
		return apdu_data
	},

	fromBuffer: (buf) => {
		if (!Buffer.isBuffer(buf)) {
			warnDebugOnly(`Buffer expected, got type=${typeof buf}`)
			return null
		}
		if (buf.length !== 4) {
			warnDebugOnly(
				`Buffer should be 4 bytes long, got ${buf.length}. buf=${buf.toString('hex')}`,
			)
			return null
		}
		const decodedValue = buf.readFloatBE(0)
		logger.debug(
			`fromBuffer decoded: value=${decodedValue} buf=${buf.toString('hex')}`,
		)
		return decodedValue
	},

	// DPT14 base type info
	basetype: {
		bitlength: 32,
		valuetype: 'basic',
		range: [-MAX_FLOAT32, MAX_FLOAT32],
		desc: '32-bit floating point value',
		help: `// Send 32-bit floating point value.
msg.payload = 42;
return msg;`,
	},

	// DPT14 subtypes info
	subtypes: {
		// TODO
		'007': {
			desc: 'DPT_Value_AngleDeg°',
			name: 'Angle, degree',
			unit: '°',
		},

		'019': {
			desc: 'DPT_Value_Electric_Current',
			name: 'Electric current',
			unit: 'A',
		},

		'027': {
			desc: 'DPT_Value_Electric_Potential',
			name: 'Electric potential',
			unit: 'V',
		},

		'028': {
			desc: 'DPT_Value_Electric_PotentialDifference',
			name: 'Electric potential difference',
			unit: 'V',
		},

		'031': {
			desc: 'DPT_Value_Energ',
			name: 'Energy',
			unit: 'J',
		},

		'032': {
			desc: 'DPT_Value_Force',
			name: 'Force',
			unit: 'N',
		},

		'033': {
			desc: 'DPT_Value_Frequency',
			name: 'Frequency',
			unit: 'Hz',
		},

		'036': {
			desc: 'DPT_Value_Heat_FlowRate',
			name: 'Heat flow rate',
			unit: 'W',
		},

		'037': {
			desc: 'DPT_Value_Heat_Quantity',
			name: 'Heat, quantity of',
			unit: 'J',
		},

		'038': {
			desc: 'DPT_Value_Impedance',
			name: 'Impedance',
			unit: 'Ω',
		},

		'039': {
			desc: 'DPT_Value_Length',
			name: 'Length',
			unit: 'm',
		},

		'051': {
			desc: 'DPT_Value_Mass',
			name: 'Mass',
			unit: 'kg',
		},

		'056': {
			desc: 'DPT_Value_Power',
			name: 'Power',
			unit: 'W',
		},

		'057': {
			desc: 'DPT_Value_Power_Factor',
			name: 'Power factor',
			unit: 'cos Φ',
		},

		'058': {
			desc: 'DPT_Value_Pressure',
			name: 'Pressure (Pa)',
			unit: 'Pa',
		},

		'065': {
			desc: 'DPT_Value_Speed',
			name: 'Speed',
			unit: 'm/s',
		},

		'066': {
			desc: 'DPT_Value_Stress',
			name: 'Stress',
			unit: 'Pa',
		},

		'067': {
			desc: 'DPT_Value_Surface_Tension',
			name: 'Surface tension',
			unit: '1/Nm',
		},

		'068': {
			desc: 'DPT_Value_Common_Temperature',
			name: 'Temperature, common',
			unit: '°C',
		},

		'069': {
			desc: 'DPT_Value_Absolute_Temperature',
			name: 'Temperature (absolute)',
			unit: 'K',
		},

		'070': {
			desc: 'DPT_Value_TemperatureDifference',
			name: 'Temperature difference',
			unit: 'K',
		},
		'074': {
			desc: 'DDPT_Value_Time',
			name: 'Time',
			unit: 's',
		},
		'076': {
			desc: 'DPT_Value_Volume',
			name: 'Volume',
			unit: 'm3',
		},
		'077': {
			desc: 'DPT_Value_Volume_Flux',
			name: 'Volume flux ',
			unit: 'm3/s',
		},
		'078': {
			desc: 'DPT_Value_Weight',
			name: 'Weight',
			unit: 'N',
		},

		'079': {
			desc: 'DPT_Value_Work',
			name: 'Work',
			unit: 'J',
		},
		'1200': {
			desc: 'DPT_Value_Volume_m3_h',
			name: 'Flow rate',
			unit: 'm³/h',
		},
	},
}

export default config
