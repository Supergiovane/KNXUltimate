/**
 * knx.js - a KNX protocol stack in pure Javascript
 * (C) 2016-2018 Elias Karakoulakis
 */

import type { DatapointConfig } from '.'

//
// DPT29: 8-byte signed value
//

const config: DatapointConfig = {
	id: 'DPT29',
	formatAPDU(value) {
		if (typeof value === 'string') value = BigInt(value)
		const apdu_data = Buffer.allocUnsafe(8)
		// Writing big integer value into buffer
		// by using writeBigInt64BE() method
		apdu_data.writeBigInt64BE(value, 0)
		return apdu_data
	},
	fromBuffer(buf) {
		return buf.readBigInt64BE(0)

		// const bufInt = (buf.readUInt32BE(0) << 8) + buf.readUInt32BE(4)
		// return bufInt.toString(16)
	},
	basetype: {
		bitlength: 64,
		signedness: 'signed',
		valuetype: 'basic',
		desc: '8-byte V64 signed value',
		// range: [-9223372036854775808, 9223372036854775807],
	},

	// DPT29 subtypes
	subtypes: {
		'010': {
			use: 'G',
			desc: 'DPT_ActiveEnergy_64',
			name: 'Active energy V64 (Wh)',
			unit: 'Wh',
		},

		'011': {
			use: 'G',
			desc: 'DPT_ApparantEnergy_V64',
			name: 'Apparant energy V64 (VAh)',
			unit: 'VAh',
		},

		'012': {
			use: 'G',
			desc: 'DPT_ReactiveEnergy_V64',
			name: 'Reactive energy V64 (VARh)',
			unit: 'VARh',
		},
	},
}

export default config
