/**
 * Provides KNX Data Point Type 15 encoding and decoding helpers.
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

import type { DatapointConfig } from '.'

//
//  DPT15.*: Access data
//

// TODO: implement fromBuffer, formatAPDU

//  DPT15 base type info
const config: DatapointConfig = {
	id: 'DPT15',
	basetype: {
		bitlength: 32,
		valuetype: 'basic',
		desc: '4-byte access control data',
	},

	//  DPT15 subtypes info
	subtypes: {
		'000': {
			name: 'Entrance access',
		},
	},
}

export default config
