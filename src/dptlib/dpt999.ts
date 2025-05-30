/**
 * knx.js - a KNX protocol stack in pure Javascript
 *  Supergiovane
 */

import { module } from '../KnxLog'
import type { DatapointConfig } from '.'
import { hexToDec } from '../utils'

//
// DPT999: 10 Bytes (RFID keypad style)
//

const logger = module('DPT999')

const config: DatapointConfig = {
	id: 'DPT999',
	formatAPDU(value) {
		if (typeof value !== 'string' || value.length < 10) {
			logger.warn(
				"Must supply an HEX string value of 10 bytes. Please don't add '$' nor '0x' Example 12340000000000000000",
			)
			return null
		}

		value = value
			.toUpperCase()
			.replace(/\$/g, '')
			.replace(/0X/g, '')
			.replace(/ /g, '') // Remove the $ and 0x
		const apdu_data = Buffer.alloc(10)
		let i = 0
		const iSlice = 2
		for (let index = 0; index < value.length; index += iSlice) {
			const sHex = value.substring(index, iSlice + index)
			const int = hexToDec(sHex)
			apdu_data[i] = int
			i++
		}
		return apdu_data
	},
	fromBuffer(buf) {
		return buf.toString('hex')
	},

	// basetype info
	basetype: {
		bitlength: 80,
		valuetype: 'basic',
		desc: '10-bytes',
		help: `// Send a code to an alarm keypad
		msg.payload = '123400000000000000'; // Or  msg.payload = '$12 $34 $00 $00 $00 $00 $00 $00 $00';
		return msg;`,
		helplink: '',
	},

	// DPT999 subtypes
	subtypes: {
		// 10 Bytes string hex value
		'001': {
			use: 'G',
			desc: '10Bytes HEX',
			name: '10 Bytes',
		},
	},
}

export default config
