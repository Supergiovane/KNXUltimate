/**
 * Provides KNX Data Point Type 9 encoding and decoding helpers.
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
import { frexp, ldexp, round } from '../utils'

//
// DPT9.*: 2-byte floating point value
//

const logger = module('DPT9')

const config: DatapointConfig = {
	id: 'DPT9',
	formatAPDU: (value) => {
		const apdu_data = Buffer.alloc(2)
		value = Number(value) // Expect a number
		if (!isFinite(value)) {
			logger.warn('cannot write non-numeric or undefined value')
		} else {
			value = round(value, 2) // Fix issue with float having too many decimals.
			const arr = frexp(value)
			const mantissa = arr[0]
			const exponent = arr[1]
			// find the minimum exponent that will upsize the normalized mantissa (0,5 to 1 range)
			// in order to fit in 11 bits ([-2048, 2047])
			let max_mantissa = 0
			let e: number
			for (e = exponent; e >= -15; e--) {
				max_mantissa = ldexp(100 * mantissa, e)
				if (max_mantissa > -2048 && max_mantissa < 2047) break
			}
			const sign = mantissa < 0 ? 1 : 0
			const mant = mantissa < 0 ? ~(max_mantissa ^ 2047) : max_mantissa
			const exp = exponent - e
			// yucks
			apdu_data[0] = (sign << 7) + (exp << 3) + (mant >> 8)
			apdu_data[1] = mant % 256
		}
		return apdu_data
	},

	fromBuffer: (buf) => {
		if (buf.length !== 2) {
			logger.warn(
				'fromBuffer: buf should be 2 bytes long (got %d bytes)',
				buf.length,
			)
			return null
		}
		// Homeassistant:
		// let data = (buf[0] * 256) + buf[1]
		// let esponente = (data >> 11) & 0x0F
		// let significand = data & 0x7FF
		// let segno = data >> 15
		// if (segno === 1) { significand = significand - 2048 }
		// let value = Number.parseFloat(significand << esponente) / 100
		// return value;

		const sign = buf[0] >> 7
		const exponent = (buf[0] & 0b01111000) >> 3
		let mantissa = 256 * (buf[0] & 0b00000111) + buf[1]
		mantissa = sign === 1 ? ~(mantissa ^ 2047) : mantissa
		return parseFloat(ldexp(0.01 * mantissa, exponent).toPrecision(15))
	},

	// DPT9 basetype info
	basetype: {
		bitlength: 16,
		valuetype: 'basic',
		desc: '16-bit floating point value',
		help: `// Send 16-bit floating point value.
  msg.payload = 25;
  return msg;`,
	},

	// DPT9 subtypes
	subtypes: {
		// 9.001 temperature (oC)
		'001': {
			name: 'Temperature (°C)',
			desc: 'temperature',
			unit: '°C',
			range: [-273, 670760],
		},

		// 9.002 temperature difference (oC)
		'002': {
			name: 'Temperature difference (°C)',
			desc: 'temperature difference',
			unit: '°C',
			range: [-670760, 670760],
		},

		// 9.003 kelvin/hour (K/h)
		'003': {
			name: 'Kelvin/hour (K/h)',
			desc: 'kelvin/hour',
			unit: '°K/h',
			range: [-670760, 670760],
		},

		// 9.004 lux (Lux)
		'004': {
			name: 'Lux (lux)',
			desc: 'lux',
			unit: 'lux',
			range: [0, 670760],
		},

		// 9.005 speed (m/s)
		'005': {
			name: 'Speed (m/s)',
			desc: 'wind speed',
			unit: 'm/s',
			range: [0, 670760],
		},

		// 9.006 pressure (Pa)
		'006': {
			name: 'Pressure (Pa)',
			desc: 'pressure',
			unit: 'Pa',
			range: [0, 670760],
		},

		// 9.007 humidity (%)
		'007': {
			name: 'Humidity (%)',
			desc: 'humidity',
			unit: '%',
			range: [0, 670760],
		},

		// 9.008 parts/million (ppm)
		'008': {
			name: 'Parts/million (ppm)',
			desc: 'air quality',
			unit: 'ppm',
			range: [0, 670760],
		},

		// 9.009 Airflow (ppm)
		'009': {
			name: 'Airflow (m3/h)',
			desc: 'Airflow',
			unit: 'm3/h',
			range: [-671088.64, 670433.28],
		},

		// 9.010 time (s)
		'010': {
			name: 'Time (s)',
			desc: 'time(sec)',
			unit: 's',
			range: [-670760, 670760],
		},

		// 9.011 time (ms)
		'011': {
			name: 'Time (ms)',
			desc: 'time(msec)',
			unit: 'ms',
			range: [-670760, 670760],
		},

		// 9.020 voltage (mV)
		'020': {
			name: 'Voltage (mV)',
			desc: 'voltage',
			unit: 'mV',
			range: [-670760, 670760],
		},

		// 9.021 current (mA)
		'021': {
			name: 'Current (mA)',
			desc: 'current',
			unit: 'mA',
			range: [-670760, 670760],
		},

		// 9.022 power density (W/m2)
		'022': {
			name: 'Power density (W/m²)',
			desc: 'power density',
			unit: 'W/m²',
			range: [-670760, 670760],
		},

		// 9.023 kelvin/percent (K/%)
		'023': {
			name: 'Kelvin/percent (K/%)',
			desc: 'Kelvin / %',
			unit: 'K/%',
			range: [-670760, 670760],
		},

		// 9.024 power (kW)
		'024': {
			name: 'Power (kW)',
			desc: 'power (kW)',
			unit: 'kW',
			range: [-670760, 670760],
		},

		// 9.025 volume flow (l/h)
		'025': {
			name: 'Volume flow (l/h)',
			desc: 'volume flow',
			unit: 'l/h',
			range: [-670760, 670760],
		},

		// 9.026 rain amount (l/m2)
		'026': {
			name: 'Rain amount (l/m²)',
			desc: 'rain amount',
			unit: 'l/m²',
			range: [-670760, 670760],
		},

		// 9.027 temperature (Fahrenheit)
		'027': {
			name: 'Temperature (Fahrenheit)',
			desc: 'temperature (F)',
			unit: '°F',
			range: [-459.6, 670760],
		},

		// 9.028 wind speed (km/h)
		'028': {
			name: 'Wind speed (km/h)',
			desc: 'wind speed (km/h)',
			unit: 'km/h',
			range: [0, 670760],
		},

		// 9.029 wind speed (km/h)
		'029': {
			name: 'Absolute humidity (g/m3)',
			desc: 'absolute humidity (g/m3)',
			unit: 'g/m3',
			range: [0, 670760],
		},

		// 9.030 concentration (ug/m3)
		'030': {
			name: 'Concentration (ug/m3)',
			desc: 'concentration (ug/m3)',
			unit: 'ug/m3',
			range: [0, 670760],
		},
	},
}

export default config
