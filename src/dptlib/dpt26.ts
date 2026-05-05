/**
 * Provides KNX Data Point Type 26 encoding and decoding helpers.
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
// DPT26: Scene Info (r1b1U6)
//

interface DPT26Value {
	info: boolean
	scenenumber: number
}

const logger = module('DPT26')

const config: DatapointConfig = {
	id: 'DPT26',
	formatAPDU: (value: DPT26Value) => {
		try {
			if (
				typeof value !== 'object' ||
				value === null ||
				!hasProp(value, 'info') ||
				!hasProp(value, 'scenenumber')
			) {
				logger.error(
					'Must supply a value object {info:true|false, scenenumber:0..63}',
				)
				return null
			}

			const info = Boolean(value.info)
			const sceneNumber = Number(value.scenenumber)
			if (!Number.isInteger(sceneNumber)) {
				logger.error('scenenumber must be an integer')
				return null
			}

			if (sceneNumber < 0 || sceneNumber > 63) {
				logger.error('scenenumber must be in range 0..63')
				return null
			}

			return Buffer.from([((info ? 1 : 0) << 6) | (sceneNumber & 0x3f)])
		} catch (error) {
			logger.error('DPT26 formatAPDU failed:', error)
			return null
		}
	},

	fromBuffer: (buf) => {
		try {
			if (!Buffer.isBuffer(buf) || buf.length !== 1) {
				logger.warn('Buffer should be 1 byte long, got', buf?.length)
				return null
			}

			const raw = buf[0]
			const sceneNumber = raw & 0x3f
			return {
				info: ((raw >> 6) & 0x01) === 1,
				scenenumber: sceneNumber,
			}
		} catch (error) {
			logger.error('DPT26 fromBuffer failed:', error)
			return null
		}
	},

	basetype: {
		bitlength: 8,
		range: [,],
		valuetype: 'composite',
		desc: 'scene information',
		help: `// info: false => scene active, true => scene inactive
// scenenumber is the KNX wire value in range 0..63
msg.payload = { info: false, scenenumber: 0 };
return msg;`,
		helplink: '',
	},

	subtypes: {
		// 26.001 DPT_SceneInfo
		'001': {
			name: 'Scene Info',
			desc: 'DPT_SceneInfo',
			use: 'G',
			unit: '',
		},
	},
}

export default config
