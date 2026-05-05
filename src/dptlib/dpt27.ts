/**
 * Provides KNX Data Point Type 27 encoding and decoding helpers.
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
// DPT27: Combined Info On/Off (B32)
// High word: mask bits M1..M16 (output available)
// Low word:  state bits S1..S16 (output on/off)
//

interface DPT27Value {
	mask: number
	state: number
}

const logger = module('DPT27')

function parseWord(value: unknown, label: string): number | null {
	const n = Number(value)
	if (!Number.isInteger(n) || n < 0 || n > 0xffff) {
		logger.error('%s must be an integer in range 0..65535', label)
		return null
	}
	return n
}

const config: DatapointConfig = {
	id: 'DPT27',
	formatAPDU: (value: DPT27Value | number) => {
		try {
			// Allow raw 32-bit value for low-level users.
			if (typeof value === 'number') {
				if (
					!Number.isInteger(value) ||
					value < 0 ||
					value > 0xffffffff
				) {
					logger.error(
						'Raw DPT27 value must be an integer in 0..4294967295',
					)
					return null
				}
				const buf = Buffer.alloc(4)
				buf.writeUInt32BE(value, 0)
				return buf
			}

			if (
				typeof value !== 'object' ||
				value === null ||
				!hasProp(value, 'mask') ||
				!hasProp(value, 'state')
			) {
				logger.error(
					'Must supply {mask:0..65535, state:0..65535} or raw uint32',
				)
				return null
			}

			const mask = parseWord(value.mask, 'mask')
			const state = parseWord(value.state, 'state')
			if (mask === null || state === null) return null

			const encoded = mask * 0x10000 + state
			const buf = Buffer.alloc(4)
			buf.writeUInt32BE(encoded, 0)
			return buf
		} catch (error) {
			logger.error('DPT27 formatAPDU failed:', error)
			return null
		}
	},

	fromBuffer: (buf) => {
		try {
			if (!Buffer.isBuffer(buf) || buf.length !== 4) {
				logger.warn('Buffer should be 4 bytes long, got', buf?.length)
				return null
			}

			const raw = buf.readUInt32BE(0)
			const mask = (raw >>> 16) & 0xffff
			const state = raw & 0xffff
			const outputs = Array.from({ length: 16 }, (_, i) => ({
				channel: i + 1,
				available: ((mask >>> i) & 0x01) === 1,
				on: ((state >>> i) & 0x01) === 1,
			}))

			return {
				mask,
				state,
				outputs,
				raw,
			}
		} catch (error) {
			logger.error('DPT27 fromBuffer failed:', error)
			return null
		}
	},

	basetype: {
		bitlength: 32,
		range: [,],
		valuetype: 'composite',
		desc: 'combined 16-channel mask/state bitset',
		help: `// mask: bitfield for available outputs (M1..M16)
// state: bitfield for on/off state (S1..S16)
msg.payload = { mask: 0xffff, state: 0x0005 };
return msg;`,
		helplink: '',
	},

	subtypes: {
		// 27.001 DPT_CombinedInfoOnOff
		'001': {
			name: 'Combined Info On/Off',
			desc: 'DPT_CombinedInfoOnOff',
			use: 'G',
			unit: '',
		},
	},
}

export default config
