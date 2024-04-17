/**
 * (C) 2020 Supergiovane
 */

//
// DPT12.*:  4-byte unsigned value
//

import Log from '../KnxLog'

import type { DatapointConfig } from '.'

const config: DatapointConfig = {
	id: 'DPT12',
	formatAPDU: (value) => {
		if (!value || typeof value !== 'number') {
			Log.get().error('DPT12: Must supply a number value')
		}
		const apdu_data = Buffer.alloc(4)
		apdu_data.writeUIntBE(value, 0, 4)
		return apdu_data
	},

	fromBuffer: (buf) => {
		if (buf.length !== 4) {
			Log.get().warn(
				'DPT12: Buffer should be 4 bytes long, got',
				buf.length,
			)
			return null
		}
		return buf.readUIntBE(0, 4)
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
