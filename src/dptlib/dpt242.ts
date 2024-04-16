/**
 * knx.js - a KNX protocol stack in pure Javascript
 * (C) 2016-2018 Elias Karakoulakis
 */

import Log from '../KnxLog'
import type { DatapointConfig } from '.'
import { hasProp, hex2bin } from '../utils'

interface DPT242Value {
	x: number
	y: number
	brightness: number
	isColorValid: boolean
	isBrightnessValid: boolean
}

//
// DPT242: 3-byte RGB xyY
//
const config: DatapointConfig = {
	id: 'DPT242',
	formatAPDU(value) {
		if (!value) {
			Log.get().error('DPT242: cannot write null value')
		} else {
			if (
				typeof value === 'object' &&
				hasProp(value, 'isColorValid') &&
				hasProp(value, 'isBrightnessValid') &&
				hasProp(value, 'x') &&
				value.x >= 0 &&
				value.x <= 65535 &&
				hasProp(value, 'y') &&
				value.y >= 0 &&
				value.y <= 65535 &&
				hasProp(value, 'brightness') &&
				value.brightness >= 0 &&
				value.brightness <= 100
			) {
				// noop
			} else {
				Log.get().error(
					'DPT242: Must supply an value {x:0-65535, y:0-65535, brightness:0-100, isColorValid:true/false, isBrightnessValid:true/false}',
				)
			}

			const bufferTotal = Buffer.alloc(6)
			const bufX = Buffer.alloc(2)
			const bufY = Buffer.alloc(2)
			const bufBrightness = Buffer.alloc(2)
			const isColorValid = value.isColorValid ? '1' : '0'
			const isBrightnessValid = value.isBrightnessValid ? '1' : '0'
			bufX.writeUInt16BE(value.x) // buf.writeUInt16LE(number);
			bufY.writeUInt16BE(value.y)
			bufBrightness.writeUInt16BE(value.brightness)
			bufBrightness[0] = parseInt(
				`000000${isColorValid}${isBrightnessValid}`,
				2,
			) // .toString(16) as any // these are Colour and Brighness validities
			bufferTotal[0] = bufX[0]
			bufferTotal[1] = bufX[1]
			bufferTotal[2] = bufY[0]
			bufferTotal[3] = bufY[1]
			bufferTotal[4] = bufBrightness[1]
			bufferTotal[5] = bufBrightness[0]

			return bufferTotal
		}
	},

	fromBuffer(buf) {
		if (buf.length !== 6) {
			Log.get().error(
				'DPT242: Buffer should be 6 bytes long, got',
				buf.length,
			)
			return null
		}
		const bufTotale = buf.toString('hex')
		// console.log("bufTotale STRINGA: " + bufTotale);
		const x = bufTotale.substring(0, 4)
		const y = bufTotale.substring(4, 8)
		const brightness = bufTotale.substring(8, 10) // these are Colour and Brighness validities (2 bit) //00000011
		const CB = bufTotale.substring(10, 12)
		const isColorValid = hex2bin(CB).substring(6, 7) === '1'
		const isBrightnessValid = hex2bin(CB).substring(7, 8) === '1'
		const ret: DPT242Value = {
			x: parseInt(x, 16),
			y: parseInt(y, 16),
			brightness: parseInt(brightness, 16),
			isColorValid,
			isBrightnessValid,
		}
		return ret
	},
	basetype: {
		bitlength: 3 * 16,
		valuetype: 'basic',
		desc: 'RGB xyY',
	},
	subtypes: {
		600: {
			desc: 'RGB xyY',
			name: 'RGB color xyY',
			unit: '',
			scalar_range: [undefined, undefined],
			range: [undefined, undefined],
		},
	},
}

export default config
