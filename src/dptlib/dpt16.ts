/**
 * KNXEngine - a KNX protocol stack in Javascript
 * (C) 2020-2022 Supergiovane
 */

import { module } from '../KnxLog'
import type { DatapointConfig } from '.'

//
// DPT16: ASCII string (max 14 chars)
//

const logger = module('DPT16')

const config: DatapointConfig = {
	id: 'DPT16',
	// Write to BUS
	formatAPDU(value) {
		if (typeof value !== 'string') {
			logger.error('Must supply a string value. Autoconversion to string')
			try {
				value = value.toString()
			} catch (error) {
				value = 'DPT Err'
			}
		}

		const buf = Buffer.alloc(14)
		if (this.subtypeid === '001') buf.write(value, 'latin1')
		if (this.subtypeid === '000') buf.write(value, 'ascii')
		return buf
	},

	// Read from BUS
	fromBuffer(buf) {
		if (buf.length !== 14) {
			logger.error('Buffer should be 14 byte long, got', buf.length)
			return null
		}
		if (this.subtypeid === '001') return buf.toString('latin1')
		if (this.subtypeid === '000') return buf.toString('ascii')
		return null
	},

	// DPT16 basetype info
	basetype: {
		bitlength: 14 * 8,
		valuetype: 'basic',
		desc: '14-character string',
		help: `// Send a text to a display
msg.payload = "Hello!"
return msg;`,
		helplink: '',
	},

	// DPT9 subtypes
	subtypes: {
		// 16.000 ASCII string
		'000': {
			use: 'G',
			desc: 'DPT_String_ASCII',
			name: 'ASCII string',
			force_encoding: 'US-ASCII',
		},

		// 16.001 ISO-8859-1 string
		'001': {
			use: 'G',
			desc: 'DPT_String_8859_1',
			name: 'ISO-8859-1 string',
			force_encoding: 'ISO-8859-1',
		},
	},
}

export default config
