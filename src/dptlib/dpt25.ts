/**
 * Provides KNX Data Point Type 25 encoding and decoding helpers.
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

import { hasProp } from '../utils'
import { module } from '../KnxLog'
import type { DatapointConfig } from '.'

//
// DPT25: Double nibble (U4U4)
//

interface DPT25Value {
	busy: number
	nak: number
}

const logger = module('DPT25')

const config: DatapointConfig = {
	id: 'DPT25',
	formatAPDU: (value: DPT25Value) => {
		try {
			if (
				typeof value !== 'object' ||
				value === null ||
				!hasProp(value, 'busy') ||
				!hasProp(value, 'nak')
			) {
				logger.error(
					'Must supply a value object {busy:0..15, nak:0..15}',
				)
				return null
			}

			const busy = Number(value.busy)
			const nak = Number(value.nak)

			if (
				!Number.isInteger(busy) ||
				!Number.isInteger(nak) ||
				busy < 0 ||
				busy > 15 ||
				nak < 0 ||
				nak > 15
			) {
				logger.error('busy and nak must be integers in range 0..15')
				return null
			}

			return Buffer.from([((busy & 0x0f) << 4) | (nak & 0x0f)])
		} catch (error) {
			logger.error('DPT25 formatAPDU failed:', error)
			return null
		}
	},

	fromBuffer: (buf) => {
		try {
			if (!Buffer.isBuffer(buf) || buf.length !== 1) {
				logger.warn('Buffer should be 1 byte long, got', buf?.length)
				return null
			}
			return {
				busy: (buf[0] >> 4) & 0x0f,
				nak: buf[0] & 0x0f,
			}
		} catch (error) {
			logger.error('DPT25 fromBuffer failed:', error)
			return null
		}
	},

	basetype: {
		bitlength: 8,
		range: [,],
		valuetype: 'composite',
		desc: 'double nibble (busy/nak)',
		help: `// Send busy and NAK repetition counters (nibbles)
msg.payload = { busy: 1, nak: 2 };
return msg;`,
		helplink: '',
	},

	subtypes: {
		// 25.1000 DPT_DoubleNibble
		'1000': {
			name: 'Double Nibble',
			desc: 'DPT_DoubleNibble',
			use: 'System',
			unit: '',
		},
	},
}

export default config
