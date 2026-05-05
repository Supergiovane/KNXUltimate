/**
 * Provides KNX Data Point Type 23 encoding and decoding helpers.
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
import type { DatapointConfig } from '.'

//
// DPT23: 2-bit enumeration (N2)
//

const logger = module('DPT23')

const config: DatapointConfig = {
	id: 'DPT23',
	formatAPDU: (value) => {
		try {
			const numeric = Number(value)
			if (!Number.isFinite(numeric) || !Number.isInteger(numeric)) {
				logger.error('Must supply an integer value (0..3)')
				return null
			}
			if (numeric < 0 || numeric > 3) {
				logger.error(
					'Value out of range for DPT23 (0..3), got',
					numeric,
				)
				return null
			}
			return Buffer.from([numeric & 0b11])
		} catch (error) {
			logger.error('DPT23 formatAPDU failed:', error)
			return null
		}
	},

	fromBuffer: (buf) => {
		try {
			if (!Buffer.isBuffer(buf) || buf.length !== 1) {
				logger.warn('Buffer should be 1 byte long, got', buf?.length)
				return null
			}
			return buf[0] & 0b11
		} catch (error) {
			logger.error('DPT23 fromBuffer failed:', error)
			return null
		}
	},

	basetype: {
		bitlength: 2,
		range: [,],
		valuetype: 'basic',
		desc: '2-bit enumeration',
		help: `// Send a 2-bit action value
// Valid values: 0..3
msg.payload = 1;
return msg;`,
		helplink: '',
	},

	subtypes: {
		// 23.001 DPT_OnOff_Action
		'001': {
			name: 'On/Off Action',
			desc: 'DPT_OnOff_Action',
			use: 'FB',
			unit: '',
			enc: {
				0: 'Off',
				1: 'On',
				2: 'Off/On',
				3: 'On/Off',
			},
		},

		// 23.002 DPT_Alarm_Reaction
		'002': {
			name: 'Alarm Reaction',
			desc: 'DPT_Alarm_Reaction',
			use: 'FB',
			unit: '',
			enc: {
				0: 'No alarm used',
				1: 'Alarm position Up',
				2: 'Alarm position Down',
				3: 'Reserved',
			},
		},

		// 23.003 DPT_UpDown_Action
		'003': {
			name: 'Up/Down Action',
			desc: 'DPT_UpDown_Action',
			use: 'FB',
			unit: '',
			enc: {
				0: 'Up',
				1: 'Down',
				2: 'Up/Down',
				3: 'Down/Up',
			},
		},

		// 23.102 DPT_HVAC_PB_Action
		'102': {
			name: 'HVAC Pushbutton Action',
			desc: 'DPT_HVAC_PB_Action',
			use: 'FB',
			unit: '',
			enc: {
				0: 'Comfort/Economy',
				1: 'Comfort/Nothing',
				2: 'Economy/Nothing',
				3: 'Building protection/Auto',
			},
		},
	},
}

export default config
