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

const config: DatapointConfig = {
	id: 'DPT14',
	formatAPDU: (value) => {
		if (!value || typeof value !== 'number') {
			logger.error('Must supply a number value. Will emit 0')
			value = 0
		}

		const apdu_data = Buffer.alloc(4)
		apdu_data.writeFloatBE(value, 0)
		return apdu_data
	},

	fromBuffer: (buf) => {
		if (buf.length !== 4) {
			logger.warn('Buffer should be 4 bytes long, got', buf.length)
			return null
		}
		return buf.readFloatBE(0)
	},

	// DPT14 base type info
	basetype: {
		bitlength: 32,
		valuetype: 'basic',
		range: [0, 2 ** 32],
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
