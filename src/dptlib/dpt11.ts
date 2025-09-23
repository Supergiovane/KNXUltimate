/**
 * Provides KNX Data Point Type 11 encoding and decoding helpers.
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
import { hasProp } from '../utils'

//
// DPT11.*: date
//

const logger = module('DPT11')

const config: DatapointConfig = {
	id: 'DPT11',
	formatAPDU: (value) => {
		if (!value) {
			logger.error('cannot write null value for DPT11')
			return null
		}
		const apdu_data = Buffer.alloc(3)

		switch (typeof value) {
			case 'string':
			case 'number':
				value = new Date(value)
				break
			case 'object':
				// this expects the month property to be zero-based (January = 0, etc.)
				if (
					value.constructor.name !== 'Date' &&
					hasProp(value, 'day') &&
					hasProp(value, 'month') &&
					hasProp(value, 'year')
				) {
					value = new Date(
						parseInt(value.year),
						parseInt(value.month),
						parseInt(value.day),
					)
				}
		}
		if (isNaN(value.getDate())) {
			logger.error(
				'Must supply a numeric timestamp, Date or String object for DPT11 Date',
			)
			return null
		}
		apdu_data[0] = value.getDate()
		apdu_data[1] = value.getMonth() + 1
		const year = value.getFullYear()
		apdu_data[2] = year - (year >= 2000 ? 2000 : 1900)
		return apdu_data
	},

	fromBuffer: (buf) => {
		if (buf.length !== 3) {
			logger.error(
				`Buffer should be 3 bytes long. Received ${buf.length}`,
			)
			return null
		}
		const day = buf[0] & 31 // 0b00011111);
		const month = buf[1] & 15 // 0b00001111);
		let year = buf[2] & 127 // 0b01111111);
		year += year > 89 ? 1900 : 2000
		if (
			day >= 1 &&
			day <= 31 &&
			month >= 1 &&
			month <= 12 &&
			year >= 1990 &&
			year <= 2089
		) {
			return new Date(year, month - 1, day)
		}
		logger.error(
			'%j => %d/%d/%d is not valid date according to DPT11, setting to 1990/01/01',
			buf,
			day,
			month,
			year,
		)
		// return new Date(1990, 01, 01);
		throw new Error('Error converting date buffer to Date object.')
		return null
	},

	// DPT11 base type info
	basetype: {
		bitlength: 24,
		valuetype: 'composite',
		desc: '3-byte date value',
		help: `// Send the date to the bus!
msg.payload = new Date().toString();
return msg;`,
		helplink:
			'https://github.com/Supergiovane/node-red-contrib-knx-ultimate/wiki/-Sample---DateTime-to-BUS',
	},

	// DPT11 subtypes info
	subtypes: {
		// 11.001 date
		'001': {
			name: 'Date',
			desc: 'Date',
		},
	},
}

export default config
