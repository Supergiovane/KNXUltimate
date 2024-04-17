/**
 * KNXEngine - a KNX protocol stack in Javascript
 * (C) 2020-2022 Supergiovane
 */

import Log from '../KnxLog'
import type { DatapointConfig } from '.'

const config: DatapointConfig = {
	id: 'DPT4',
	formatAPDU: (value: string) => {
		if (!value) {
			Log.get().warn('DPT4: cannot write null value')
		} else {
			if (typeof value === 'string') {
				const apdu_data = value.charCodeAt(0)
				if (apdu_data > 255)
					Log.get().warn('DPT4: must supply an ASCII character')
				return Buffer.from([apdu_data])
			}
			Log.get().warn('DPT4: Must supply a character or string')
		}
	},
	fromBuffer: (buf: Buffer) => {
		if (buf.length !== 1) {
			Log.get().warn(
				'DPT4: Buffer should be 1 byte long, got',
				buf.length,
			)
			return null
		}
		return String.fromCharCode(buf[0])
	},
	// DPT basetype info hash
	basetype: {
		bitlength: 8,
		valuetype: 'basic',
		desc: '8-bit character',
		help: `// Send a single character in ascii or ISO
msg.payload = "A";
return msg;`,
		helplink: '',
	},
	// DPT subtypes info hash
	subtypes: {
		// 4.001 character (ASCII)
		'001': {
			name: 'Char ASCII',
			desc: 'ASCII character (0-127)',
			range: [0, 127],
			use: 'G',
		},
		// 4.002 character (ISO-8859-1)
		'002': {
			name: 'Char 8859 1',
			desc: 'ISO-8859-1 character (0..255)',
			use: 'G',
		},
	},
}

export default config
