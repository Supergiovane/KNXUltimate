/**
 * KNXEngine - a KNX protocol stack in Javascript
 * (C) 2020-2022 Supergiovane
 */

import { module } from '../KnxLog'
import type { DatapointConfig } from '.'

//
// DPT10.*: time (3 bytes)
//
// const timeRegexp = /((\d)\/)?(\d{1,2}):(\d{1,2}):(\d{1,2})/
const timeRegexp = /(\d{1,2}):(\d{1,2}):(\d{1,2})/
// DPTFrame to parse a DPT10 frame.
// Always 8-bit aligned.

const logger = module('DPT10')

const config: DatapointConfig = {
	id: 'DPT10',
	formatAPDU: (value) => {
		const apdu_data = Buffer.alloc(3)
		let dow
		let hour
		let minute
		let second
		// day of week. NOTE: JS Sunday = 0
		switch (typeof value) {
			case 'string':
				{
					// try to parse
					const match = timeRegexp.exec(value)
					if (match) {
						dow = ((new Date().getDay() - 7) % 7) + 7
						hour = parseInt(match[1])
						minute = parseInt(match[2])
						second = parseInt(match[3])
					} else {
						logger.warn('invalid time format (%s)', value)
					}
				}
				break
			case 'object':
				if (value.constructor.name !== 'Date') {
					logger.warn('Must supply a Date or String for DPT10 time')
					break
				}
			// eslint-disable-next-line no-fallthrough
			case 'number':
				value = new Date(value)

			// eslint-disable-next-line no-fallthrough
			default:
				dow = ((value.getDay() - 7) % 7) + 7
				hour = value.getHours()
				minute = value.getMinutes()
				second = value.getSeconds()
		}
		apdu_data[0] = (dow << 5) + hour
		apdu_data[1] = minute
		apdu_data[2] = second
		return apdu_data
	},

	// return a JS Date from a DPT10 payload, with DOW/hour/month/seconds set to the buffer values.
	// The week/month/year are inherited from the current timestamp.
	// If day of week is 0, then the KNX device has not sent this optional value (Supergiovane)
	fromBuffer: (buf) => {
		if (buf.length !== 3) {
			logger.error('Buffer should be 3 bytes long, got', buf.length)
			return null
		}
		const d = new Date()
		let dow = (buf[0] & 0b11100000) >> 5 // Day of week
		const hours = buf[0] & 0b00011111
		const minutes = buf[1]
		const seconds = buf[2]
		if (
			hours >= 0 &&
			hours <= 23 &&
			minutes >= 0 &&
			minutes <= 59 &&
			seconds >= 0 &&
			seconds <= 59
		) {
			// 18/10/2021 if dow = 0, then the KNX device has not sent this optional value.
			if (d.getDay() !== dow && dow > 0) {
				if (dow === 7) dow = 0 // 18/10/2021 fix for the Sunday
				// adjust day of month to get the day of week right
				d.setDate(d.getDate() + dow - d.getDay())
			}
			d.setHours(hours)
			d.setMinutes(minutes)
			d.setSeconds(seconds)
		} else {
			logger.warn(
				'buffer %j (decoded as %d:%d:%d) is not a valid time',
				buf,
				hours,
				minutes,
				seconds,
			)
		}
		return d
	},

	// DPT10 base type info
	basetype: {
		bitlength: 24,
		valuetype: 'composite',
		desc: 'day of week + time of day',
		help: `// Send the time to the bus!
msg.payload = new Date().toString();
return msg;`,
		helplink:
			'https://github.com/Supergiovane/node-red-contrib-knx-ultimate/wiki/-Sample---DateTime-to-BUS',
	},

	// DPT10 subtypes info
	subtypes: {
		// 10.001 time of day
		'001': {
			name: 'Time of day',
			desc: 'time of day',
		},
	},
}

export default config
