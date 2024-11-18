/**
 * KNXEngine - a KNX protocol stack in Javascript
 * (C) 2020-2022 Supergiovane
 */

import Log from '../KnxLog'
import { hasProp } from '../utils'
import type { DatapointConfig } from '.'

const config: DatapointConfig = {
	id: 'DPT3',
	formatAPDU: (value: { decr_incr: number; data: number }) => {
		if (!value) {
			Log.get().warn('DPT3: cannot write null value')
			return null
		}

		const apdu_data = Buffer.alloc(1)
		if (
			typeof value === 'object' &&
			hasProp(value, 'decr_incr') &&
			hasProp(value, 'data')
		) {
			apdu_data[0] =
				((value.decr_incr ? 1 : 0) << 3) | (value.data & 0b00000111)
		} else {
			Log.get().error('Must supply a value object of {decr_incr, data}')
		}
		return apdu_data
	},
	fromBuffer: (buf: Buffer) => {
		if (buf.length !== 1) {
			Log.get().error(
				'DPT3: Buffer should be 1 byte long, got',
				buf.length,
			)
			return null
		}
		return {
			decr_incr: (buf[0] & 0b00001000) >> 3 ? 1 : 0,
			data: buf[0] & 0b00000111,
		}
	},
	// DPT basetype info hash
	basetype: {
		bitlength: 4,
		valuetype: 'composite',
		desc: '4-bit relative dimming control',
		help: `// The parameter "data" indicates the relative amount of the dimming commmand (how much to dim).
// The parameter "data" can be any integer value from 0 to 7
// The parameter decr_incr:1 increases the light
// The parameter decr_incr:0 decreases the light
// The parameter data:0 stops the dimming
msg.payload={decr_incr: 1, data: 5};
return msg;`,
		helplink:
			'https://github.com/Supergiovane/node-red-contrib-knx-ultimate/wiki/-Sample---Dimming',
	},
	// DPT subtypes info hash
	subtypes: {
		// 3.007 dimming control
		'007': {
			name: 'Dimming control',
			desc: 'dimming control',
		},
		// 3.008 blind control
		'008': {
			name: 'Blinds control',
			desc: 'blinds control',
		},
	},
}

export default config
