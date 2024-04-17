/**
 * KNXEngine - a KNX protocol stack in Javascript
 * (C) 2020-2022 Supergiovane
 */

import type { DatapointConfig } from '.'

//
// DPT17: Scene number
//

// TODO: implement fromBuffxer, formatAPDU

const config: DatapointConfig = {
	id: 'DPT17',
	// DPT17 basetype info
	basetype: {
		bitlength: 8,
		valuetype: 'basic',
		desc: 'scene number',
	},

	// DPT17 subtypes
	subtypes: {
		// 17.001 Scene number
		'001': {
			use: 'G',
			desc: 'DPT_SceneNumber',
			name: 'Scene Number',
		},
	},
}

export default config
