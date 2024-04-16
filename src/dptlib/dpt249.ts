/**
 * knx.js - a KNX protocol stack in pure Javascript
 * (C) 2016-2018 Elias Karakoulakis
 */

import Log from '../KnxLog'
import type { DatapointConfig } from '.'
import { hasProp, hex2bin } from '../utils'

//
// DPT249: 3-byte RGB xyY
// The info about validity of Colour and Brighness are omitted.
//
const config: DatapointConfig = {
	id: 'DPT249',
	formatAPDU(value) {
		if (!value) {
			Log.get().error('DPT249: cannot write null value')
		} else {
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
				Log.get().error(
					'DPT249: Must supply an value, for example {transitionTime:100, colourTemperature:1000, absoluteBrightness:80, isTimePeriodValid:true, isAbsoluteColourTemperatureValid:true, isAbsoluteBrightnessValid:true}',
				)
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
		}
	},
	fromBuffer(buf) {
		if (buf.length !== 6) {
			Log.get().error(
				'DPT249: Buffer should be 6 bytes long, got',
				buf.length,
			)
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
	},

	subtypes: {
		600: {
			desc: 'DPT_Brightness_Colour_Temperature_Transition',
			name: 'Brightness Colour Temperature Transition',
			unit: '',
			scalar_range: [undefined, undefined],
			range: [undefined, undefined],
		},
	},
}

export default config
