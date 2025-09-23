/**
 * Provides KNX Data Point Type 29 encoding and decoding helpers.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

/**
 * knx.js - a KNX protocol stack in pure Javascript
 *  Supergiovane
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
		help: `// Send 8-byte signed value range: [-9223372036854775808, 9223372036854775807].
	// REMEMBER to add "n" after a big integer number, or pass the number as string
	msg.payload = 9223372036854775808n; // numerical value with "n" at the end, representing a bigint
	msg.payload = "9223372036854775808"; // string value, that will be automatically converted into bigint
	return msg;`,
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
