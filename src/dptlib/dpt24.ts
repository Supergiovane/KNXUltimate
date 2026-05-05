/**
 * Provides KNX Data Point Type 24 encoding and decoding helpers.
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

//
// DPT24: Variable length ISO-8859-1 string (null-terminated)
//

const logger = module('DPT24')

const config: DatapointConfig = {
	id: 'DPT24',
	formatAPDU: (value) => {
		try {
			if (value === null || value === undefined) {
				logger.error('cannot write null value')
				return null
			}
			let text = value
			if (typeof text !== 'string') {
				try {
					text = text.toString()
				} catch (error) {
					logger.error('Must supply a string-compatible value')
					return null
				}
			}

			const payload = Buffer.from(text, 'latin1')
			// KNX DPT24 strings are variable length and terminated by NUL.
			if (payload.length === 0 || payload[payload.length - 1] !== 0x00) {
				return Buffer.concat([payload, Buffer.from([0x00])])
			}
			return payload
		} catch (error) {
			logger.error('DPT24 formatAPDU failed:', error)
			return null
		}
	},

	fromBuffer: (buf) => {
		try {
			if (!Buffer.isBuffer(buf) || buf.length < 1) {
				logger.warn(
					'Buffer should contain at least 1 byte, got',
					buf?.length,
				)
				return null
			}
			const terminatorIndex = buf.indexOf(0x00)
			const endIndex = terminatorIndex >= 0 ? terminatorIndex : buf.length
			return buf.subarray(0, endIndex).toString('latin1')
		} catch (error) {
			logger.error('DPT24 fromBuffer failed:', error)
			return null
		}
	},

	basetype: {
		bitlength: 8,
		range: [,],
		valuetype: 'basic',
		desc: 'variable-length ISO-8859-1 string',
		help: `// Send a variable-length ISO-8859-1 string
msg.payload = "Hello KNX";
return msg;`,
		helplink: '',
	},

	subtypes: {
		// 24.001 DPT_VarString_8859_1
		'001': {
			name: 'Variable String ISO-8859-1',
			desc: 'DPT_VarString_8859_1',
			use: 'G',
			unit: '',
			force_encoding: 'ISO-8859-1',
		},
	},
}

export default config
