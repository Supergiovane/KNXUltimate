/**
 * KNXEngine - a KNX protocol stack in Javascript
 * (C) 2016-2019 Supergiovane
 */

import { hasProp } from '../utils'
import type { DatapointConfig } from '.'
import Log from '../KnxLog'

//
// DPT232: 3-byte RGB color array
// MSB: Red, Green, LSB: Blue
//
const config: DatapointConfig = {
	id: 'DPT232',
	formatAPDU: (value) => {
		if (!value) {
			Log.get().error('DPT232: cannot write null value')
			return null
		}
		if (
			typeof value === 'object' &&
			hasProp(value, 'red') &&
			value.red >= 0 &&
			value.red <= 255 &&
			hasProp(value, 'green') &&
			value.green >= 0 &&
			value.green <= 255 &&
			hasProp(value, 'blue') &&
			value.blue >= 0 &&
			value.blue <= 255
		) {
			return Buffer.from([
				Math.floor(value.red),
				Math.floor(value.green),
				Math.floor(value.blue),
			])
		}
		Log.get().error(
			'DPT232: Must supply an value {red:0-255, green:0-255, blue:0-255}',
		)
		return null
	},

	fromBuffer: (buf) => {
		if (buf.length !== 3) {
			Log.get().error(
				'DPT232: Buffer should be 3 byte long, got',
				buf.length,
			)
			return null
		}
		const ret = { red: buf[0], green: buf[1], blue: buf[2] }
		return ret
	},

	basetype: {
		bitlength: 3 * 8,
		valuetype: 'basic',
		desc: 'RGB array',
		help: `// Each color in a range between 0 and 255
msg.payload={red:255, green:200, blue:30};
return msg;`,
		helplink:
			'https://github.com/Supergiovane/node-red-contrib-knx-ultimate/wiki/-Sample---RGB-Color',
	},

	subtypes: {
		600: {
			desc: 'RGB',
			name: 'RGB color triplet',
			unit: '',
			scalar_range: [,],
			range: [,],
		},
	},
}

export default config
