/**
 * knx.js - a KNX protocol stack in pure Javascript
 *  Supergiovane
 */

import { module } from '../KnxLog'
import type { DatapointConfig } from '.'
import { hasProp, hex2bin } from '../utils'

//
// DPT249: 3-byte RGB xyY
// The info about validity of Colour and Brighness are omitted.
//

const logger = module('DPT249')

const config: DatapointConfig = {
	id: 'DPT249',
	formatAPDU(value) {
		if (!value) {
			logger.error('cannot write null value')
			return null
		}
		if (
			typeof value === 'object' &&
			hasProp(value, 'isTimePeriodValid') &&
			hasProp(value, 'isAbsoluteColourTemperatureValid') &&
			hasProp(value, 'isAbsoluteBrightnessValid') &&
			hasProp(value, 'transitionTime') &&
			hasProp(value, 'colourTemperature') &&
			value.colourTemperature >= 0 &&
			value.colourTemperature <= 65535 &&
			hasProp(value, 'absoluteBrightness') &&
			value.absoluteBrightness >= 0 &&
			value.absoluteBrightness <= 100
		) {
			// noop
		} else {
			logger.error(
				'Must supply an value, for example {transitionTime:100, colourTemperature:1000, absoluteBrightness:80, isTimePeriodValid:true, isAbsoluteColourTemperatureValid:true, isAbsoluteBrightnessValid:true}',
			)
			return null
		}

		const bufferTotal = Buffer.alloc(6)
		const transitionTime = Buffer.alloc(2)
		const colourTemperature = Buffer.alloc(2)
		const absoluteBrightness = Buffer.alloc(2)
		const isTimePeriodValid = value.isTimePeriodValid ? '1' : '0'
		const isAbsoluteColourTemperatureValid =
			value.isAbsoluteColourTemperatureValid ? '1' : '0'
		const isAbsoluteBrightnessValid = value.isAbsoluteBrightnessValid
			? '1'
			: '0'
		transitionTime.writeUInt16BE(value.transitionTime) // buf.writeUInt16LE(number);
		colourTemperature.writeUInt16BE(value.colourTemperature)
		absoluteBrightness.writeUInt16BE(value.absoluteBrightness)
		absoluteBrightness[0] = parseInt(
			`00000${isTimePeriodValid}${isAbsoluteColourTemperatureValid}${isAbsoluteBrightnessValid}`,
			2,
		) // .toString(16) // these are Colour and Brighness validities
		bufferTotal[0] = transitionTime[0]
		bufferTotal[1] = transitionTime[1]
		bufferTotal[2] = colourTemperature[0]
		bufferTotal[3] = colourTemperature[1]
		bufferTotal[4] = absoluteBrightness[1]
		bufferTotal[5] = absoluteBrightness[0]
		return bufferTotal
	},
	fromBuffer(buf) {
		if (buf.length !== 6) {
			logger.error('Buffer should be 6 bytes long, got', buf.length)
			return null
		}
		const bufTotale = buf.toString('hex')
		const transitionTime = bufTotale.substring(0, 4)
		const colourTemperature = bufTotale.substring(4, 8)
		const absoluteBrightness = bufTotale.substring(8, 10) // This is 1 Byte of validities (3 bit) //00000111
		const CB = bufTotale.substring(10, 12)
		const isTimePeriodValid = hex2bin(CB).substring(5, 6) === '1'
		const isAbsoluteColourTemperatureValid =
			hex2bin(CB).substring(6, 7) === '1'
		const isAbsoluteBrightnessValid = hex2bin(CB).substring(7, 8) === '1'
		const ret = {
			transitionTime: parseInt(transitionTime, 16),
			colourTemperature: parseInt(colourTemperature, 16),
			absoluteBrightness: parseInt(absoluteBrightness, 16),
			isTimePeriodValid,
			isAbsoluteColourTemperatureValid,
			isAbsoluteBrightnessValid,
		}
		return ret
	},
	basetype: {
		bitlength: 2 * 16 + 2 * 8,
		valuetype: 'basic',
		desc: 'PDT_GENERIC_06',
		help: `// Brightness Colour Temperature Transition.
// Properties: transitionTime is in milliseconds, colourTemperature is Kelvin (0-65535 with resolution of 1K)
// absoluteBrightness (0-255), isTimePeriodValid (true/false), isAbsoluteColourTemperatureValid (true/false), isAbsoluteBrightnessValid (true/false)
msg.payload={transitionTime:100, colourTemperature:1000, absoluteBrightness:80, isTimePeriodValid:true, isAbsoluteColourTemperatureValid:true, isAbsoluteBrightnessValid:true};
return msg;`,
	},

	subtypes: {
		600: {
			desc: 'DPT_Brightness_Colour_Temperature_Transition',
			name: 'Brightness Colour Temperature Transition',
			unit: '',
			scalar_range: [,],
			range: [,],
		},
	},
}

export default config
