/**
 * KNXEngine - a KNX protocol stack in Javascript
 * 08/04/2020 Supergiovane
 */
import { hasProp } from '../utils'
import type { DatapointConfig } from '.'

//
// DPT18: 8-bit Scene Control
//

/*
    class DPT18_Frame < DPTFrame
        bit1  :exec_learn, {
            :display_name : "Execute=0, Learn = 1"
        }
        bit1  :pad, {
            :display_name : "Reserved bit"
        }
        bit6  :data, {
            :display_name : "Scene number"
        }
    end
*/

// TODO: implement fromBuffer, formatAPDU
import Log from '../KnxLog'

const config: DatapointConfig = {
	id: 'DPT18',
	formatAPDU: (value) => {
		if (!value) {
			Log.get().warn('DPT18: cannot write null value')
			return null
		}
		const apdu_data = Buffer.alloc(1)
		if (
			typeof value === 'object' &&
			hasProp(value, 'save_recall') &&
			hasProp(value, 'scenenumber')
		) {
			if (value.scenenumber - 1 > 64 || value.scenenumber - 1 < 1) {
				Log.get().error('DPT18: scenenumber must between 1 and 64')
				return null
			}
			const sSceneNumberbinary = ((value.scenenumber - 1) >>> 0).toString(
				2,
			)
			const sVal = `${
				value.save_recall
			}0${sSceneNumberbinary.padStart(6, '0')}`
			apdu_data[0] = parseInt(sVal, 2) // 0b10111111;
			return apdu_data
		}
		Log.get().error(
			'DPT18: Must supply a value object of {save_recall, scenenumber}',
		)
		return null

		return null
	},

	fromBuffer: (buf) => {
		if (buf.length !== 1) {
			Log.get().error(
				'DP18: Buffer should be 1 byte long, got',
				buf.length,
			)
			return null
		}
		const sBit = parseInt(buf.toString('hex').toUpperCase(), 16)
			.toString(2)
			.padStart(8, '0') // Get bit from hex
		return {
			save_recall: Number(sBit.substring(0, 1)),
			scenenumber: parseInt(sBit.substring(2), 2) + 1,
		}
		return null
	},

	// DPT18 basetype info
	basetype: {
		bitlength: 8,
		valuetype: 'composite',
		desc: '8-bit Scene Activate/Learn + number',
		help: `// To save and recall scene, use payload:{"ave_recall:0, scenenumber:2}
// save_recall = 0 recalls the scene
// save_recall = 1 saves the scene
// scenenumber is the number of the scene to be recalled or saved
return {payload:{save_recall:0, scenenumber:2}};`,
		helplink:
			'https://github.com/Supergiovane/node-red-contrib-knx-ultimate/wiki/-Sample---Control-a-scene-actuator',
	},

	// DPT18 subtypes
	subtypes: {
		// 18.001 DPT_SceneControl
		'001': {
			desc: 'DPT_SceneControl',
			name: 'Scene control',
		},
	},

	/*
02/April/2020 Supergiovane
USE:
Input must be an object: {save_recall, scenenumber}
save_recall: 0 = recall scene, 1 = save scene
scenenumber: the scene number, example 1
Example: {save_recall=0, scenenumber=2}
*/
}

export default config
