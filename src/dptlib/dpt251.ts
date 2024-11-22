/**

* (C) 2020 Supergiovane
*/

/**
 * knx.js - a KNX protocol stack in pure Javascript
 *  Supergiovane
 */

import { module } from '../KnxLog'
import type { DatapointConfig } from '.'
import { hasProp } from '../utils'

// Structure of DPT 251.600
// Byte 0: R value
// Byte 1: G value
// Byte 2: B value
// Byte 3: W value
// Byte 4: 0x00 (reserved)
// Byte 5:
// Bit 0: W value valid?
// Bit 1: B value valid?
// Bit 2: G value valid?
// Bit 3: R value valid?
// Bit 4-7: 0
// The bitfield which defines whether an value(R, G, B, W) is valid or not should be in the last byte of the array and not at the beginning.This can be verified by trying to send a DPT 251.600 telegram in the BUS monitor of the ETS5 application.

const logger = module('DPT251')

const config: DatapointConfig = {
	id: 'DPT251',
	formatAPDU(value) {
		if (!value) {
			logger.error('cannot write null value')
		} else {
			if (
				typeof value === 'object' &&
				hasProp(value, 'white') &&
				value.white >= 0 &&
				value.white <= 255 &&
				hasProp(value, 'red') &&
				value.red >= 0 &&
				value.red <= 255 &&
				hasProp(value, 'green') &&
				value.green >= 0 &&
				value.green <= 255 &&
				hasProp(value, 'blue') &&
				value.blue >= 0 &&
				value.blue <= 255 &&
				hasProp(value, 'mR') &&
				hasProp(value, 'mG') &&
				hasProp(value, 'mB') &&
				hasProp(value, 'mW')
			) {
				// noop
			} else {
				logger.error(
					'Must supply a value payload: {red:0-255, green:0-255, blue:0-255, white:0-255, mR:0-1, mG:0-1, mB:0-1, mW:0-1}',
				)
			}
			const bitVal = parseInt(
				`0000${value.mR}${value.mG}${value.mB}${value.mW}`,
				2,
			)

			return Buffer.from([
				Math.floor(value.red),
				Math.floor(value.green),
				Math.floor(value.blue),
				Math.floor(value.white),
				Math.floor(0),
				Math.floor(bitVal),
			])
		}
		return null
	},
	fromBuffer(buf) {
		if (buf.length !== 6) {
			logger.error('Buffer should be 6 bytes long, got', buf.length)
			return null
		}
		const valByte = buf[5].toString(2) // Get validity bits
		const ret = {
			red: buf[0],
			green: buf[1],
			blue: buf[2],
			white: buf[3],
			mR: parseInt(valByte[0]) || 0,
			mG: parseInt(valByte[1]) || 0,
			mB: parseInt(valByte[2]) || 0,
			mW: parseInt(valByte[3]) || 0,
		}
		return ret
		return null
	},
	basetype: {
		bitlength: 6 * 8,
		valuetype: 'basic',
		desc: 'RGBW array',
		help: `// Each color + white in a range between 0 and 255, the latest 4 bits in range 0 to 1
// red:0-255, green:0-255, blue:0-255, white:0-255, mR:0-1, mG:0-1, mB:0-1, mW:0-1
msg.payload={red:90, green:200, blue:30, white:120, mR:1, mG:1, mB:1, mW:1};
return msg;`,
		helplink:
			'https://github.com/Supergiovane/node-red-contrib-knx-ultimate/wiki/-Sample---RGBW-Color-plus-White',
	},
	subtypes: {
		600: {
			desc: 'RGBW [payload:{red:255, green:200, blue:30, white:50, mR:1, mG:1, mB:1, mW:1}]',
			name: 'RGB color triplet + White + Validity',
			unit: '',
			scalar_range: [,],
			range: [,],
		},
	},
}

export default config
