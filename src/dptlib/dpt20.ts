/**
 * KNXEngine - a KNX protocol stack in Javascript
 * (C) 2020-2022 Supergiovane
 */

import type { DatapointConfig } from '.'
import Log from '../KnxLog'

//
// DPT20: 1-byte HVAC
//
// FIXME: help needed
const config: DatapointConfig = {
	id: 'DPT20',
	formatAPDU: (value) => {
		const apdu_data = Buffer.alloc(1)
		apdu_data[0] = value
		Log.get().debug(
			`./knx/src/dpt20.js : input value = ${value}   apdu_data = ${apdu_data}`,
		)
		return apdu_data
	},

	fromBuffer: (buf) => {
		if (buf.length !== 1) {
			Log.get().warn(
				'DPT20: Buffer should be 1 byte long, got',
				buf.length,
			)
			return null
		}
		const ret = buf.readUInt8(0)
		// Log.get().debug('               dpt20.js   fromBuffer : ' + ret);
		return ret
	},

	basetype: {
		bitlength: 8,
		range: [,],
		valuetype: 'basic',
		desc: '1-byte',
		help: `// Send Value. Example for HVAC: 0 = Auto, 1 = Comfort, 2 = Standby, 3 = Economy, 4 = Building protection
msg.payload = 1; // Set to Comfort
return msg;`,
		helplink: '',
	},

	subtypes: {
		// 20.102 HVAC mode
		102: {
			name: 'HVAC Mode',
			desc: '',
			unit: '',
			scalar_range: [,],
			range: [,],
		},
	},
}

export default config
