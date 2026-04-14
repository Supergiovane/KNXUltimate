/**
 * Provides KNX Data Point Type 12 encoding and decoding helpers.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

/**
 * (C) 2020 Supergiovane
 */

//
// DPT12.*:  4-byte unsigned value
//

import { module } from '../KnxLog'

import type { DatapointConfig } from '.'

const logger = module('DPT12')
const MAX_UINT32 = 0xffffffff

function isDebugEnabled(): boolean {
	if (typeof logger.isLevelEnabled === 'function') {
		return logger.isLevelEnabled('debug')
	}
	return logger.level === 'debug'
}

function errorDebugOnly(message: string, ...args: unknown[]): void {
	if (isDebugEnabled()) logger.error(message, ...args)
}

function warnDebugOnly(message: string, ...args: unknown[]): void {
	if (isDebugEnabled()) logger.warn(message, ...args)
}

const config: DatapointConfig = {
	id: 'DPT12',
	formatAPDU: (value, context) => {
		const logSuffix = context?.logSuffix || ''
		const inputType = typeof value
		let normalizedValue = value

		if (inputType !== 'number' || !Number.isFinite(value)) {
			const coercedValue = Number(value)
			if (Number.isFinite(coercedValue)) {
				errorDebugOnly(
					`Must supply a number value. Input was coerced to ${coercedValue}${logSuffix}`,
				)
				logger.debug(
					`formatAPDU coercion: input=%j inputType=%s coerced=%d${logSuffix}`,
					value,
					inputType,
					coercedValue,
				)
				normalizedValue = coercedValue
			} else {
				errorDebugOnly(
					`Must supply a finite number value. Will emit 0${logSuffix}`,
				)
				logger.debug(
					`formatAPDU invalid input: input=%j inputType=%s finite=%s${logSuffix}`,
					value,
					inputType,
					Number.isFinite(value),
				)
				normalizedValue = 0
			}
		}

		if (!Number.isInteger(normalizedValue)) {
			const truncatedValue = Math.trunc(normalizedValue)
			logger.debug(
				`formatAPDU non-integer value: input=%j normalized=%d truncated=%d${logSuffix}`,
				value,
				normalizedValue,
				truncatedValue,
			)
			normalizedValue = truncatedValue
		}

		if (normalizedValue < 0 || normalizedValue > MAX_UINT32) {
			errorDebugOnly(
				`Value out of range for DPT12 (${normalizedValue}). Will emit 0${logSuffix}`,
			)
			logger.debug(
				`formatAPDU range check failed: input=%j normalized=%d min=0 max=%d${logSuffix}`,
				value,
				normalizedValue,
				MAX_UINT32,
			)
			normalizedValue = 0
		}

		const apdu_data = Buffer.alloc(4)
		apdu_data.writeUIntBE(normalizedValue, 0, 4)
		logger.debug(
			`formatAPDU encoded: input=%j normalized=%d apdu=${apdu_data.toString('hex')}${logSuffix}`,
			value,
			normalizedValue,
		)
		return apdu_data
	},

	fromBuffer: (buf) => {
		if (buf.length !== 4) {
			warnDebugOnly(
				`Buffer should be 4 bytes long, got ${buf.length}. buf=${buf.toString('hex')}`,
			)
			return null
		}
		const decodedValue = buf.readUIntBE(0, 4)
		logger.debug(
			`fromBuffer decoded: value=${decodedValue} buf=${buf.toString('hex')}`,
		)
		return decodedValue
	},

	// DPT12 base type info
	basetype: {
		bitlength: 32,
		signedness: 'unsigned',
		valuetype: 'basic',
		desc: '4-byte unsigned value',
		help: `// Send 4-byte unsigned value
msg.payload = 12;
return msg;`,
	},

	// DPT12 subtype info
	subtypes: {
		// 12.001 counter pulses
		'001': {
			name: 'Counter pulses (unsigned)',
			desc: 'Counter pulses',
		},
		100: {
			name: 'Counter timesec (s)',
			desc: 'Counter timesec (s)',
		},
		101: {
			name: 'Counter timemin (min)',
			desc: 'Counter timemin (min)',
		},
		102: {
			name: 'Counter timehrs (h)',
			desc: 'Counter timehrs (h)',
		},
		1200: {
			name: 'Volume liquid (l)',
			desc: 'Volume liquid (l)',
		},
		1201: {
			name: 'Volume (m3)',
			desc: 'Volume m3',
		},
	},
}

export default config
