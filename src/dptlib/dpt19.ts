/**
 * KNXEngine - a KNX protocol stack in Javascript
 * (C) 2020-2022 Supergiovane
 */

import type { DatapointConfig } from '.'
import { module } from '../KnxLog'

// TODO: implement fromBuffer, formatAPDU

//
// DPT19: 8-byte Date and Time
//

const logger = module('DPT19')

const config: DatapointConfig = {
	id: 'DPT19',
	formatAPDU: (value) => {
		if (typeof value !== 'object' || value.constructor.name !== 'Date') {
			logger.error('Must supply a Date object')
			return null
		}
		// Sunday is 0 in Javascript, but 7 in KNX.
		const day = value.getDay() === 0 ? 7 : value.getDay()
		const apdu_data = Buffer.alloc(8)
		apdu_data[0] = value.getFullYear() - 1900
		apdu_data[1] = value.getMonth() + 1
		apdu_data[2] = value.getDate()
		apdu_data[3] = (day << 5) + value.getHours()
		apdu_data[4] = value.getMinutes()
		apdu_data[5] = value.getSeconds()
		apdu_data[6] = 0
		apdu_data[7] = 0
		return apdu_data

		return null
	},

	fromBuffer: (buf) => {
		if (buf.length !== 8) {
			logger.warn('Buffer should be 8 bytes long, got', buf.length)
			return null
		}
		const d = new Date(
			buf[0] + 1900,
			buf[1] - 1,
			buf[2],
			buf[3] & 0b00011111,
			buf[4],
			buf[5],
		)
		return d
		return null
	},

	basetype: {
		bitlength: 64,
		valuetype: 'composite',
		desc: '8-byte Date+Time',
		help: `// Setting date/time using DPT 19.001
// This sends both date and time to the KNX BUS
msg.payload = new Date();
return msg;`,
		helplink:
			'https://github.com/Supergiovane/node-red-contrib-knx-ultimate/wiki/-Sample---DateTime-to-BUS',
	},

	subtypes: {
		// 19.001
		'001': {
			name: 'Date time',
			desc: 'datetime',
		},
	},
}

export default config
