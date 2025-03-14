/**
 * knx.js - a KNX protocol stack in pure Javascript
 *  Supergiovane
 */

import { module } from '../KnxLog'
import type { DatapointConfig } from '.'
import { hasProp } from '../utils'
import dpt9 from './dpt9'

//
// 4x DPT9.* 2-byte floating point value
//

const logger = module('DPT275')

const config: DatapointConfig = {
	id: 'DPT275',
	formatAPDU(value) {
		// Get the javascript object and create a telegram for the KNX bus.
		if (
			typeof value === 'object' &&
			hasProp(value, 'comfort') &&
			hasProp(value, 'standby') &&
			hasProp(value, 'economy') &&
			hasProp(value, 'buildingProtection')
		) {
			const comfort = dpt9.formatAPDU(value.comfort) as Buffer
			const standby = dpt9.formatAPDU(value.standby) as Buffer
			const economy = dpt9.formatAPDU(value.economy) as Buffer
			const buildingProtection = dpt9.formatAPDU(
				value.buildingProtection,
			) as Buffer
			return Buffer.concat([
				comfort,
				standby,
				economy,
				buildingProtection,
			])
		}
		logger.error(
			'formatAPDU: Must supply all values, for example {comfort:22, standby:21.5, economy:21, buildingProtection:15}',
		)
		return null
	},
	fromBuffer(buf) {
		// Get the telegram from the KNX bus and create a javascript object.
		if (buf.length !== 8) {
			logger.warn(
				'fromBuffer: buf should be 8 bytes long (got %d bytes)',
				buf.length,
			)
			return null
		}
		const comfort = dpt9.fromBuffer(buf.subarray(0, 2))
		const standby = dpt9.fromBuffer(buf.subarray(2, 4))
		const economy = dpt9.fromBuffer(buf.subarray(4, 6))
		const buildingProtection = dpt9.fromBuffer(buf.subarray(6, 8))
		return {
			comfort,
			standby,
			economy,
			buildingProtection,
		}
		return null
	},

	// DPT275 basetype info
	basetype: {
		bitlength: 64,
		valuetype: 'basic',
		desc: 'Quadruple setpoints (comfort,standby,economy,buildingProtection) (4 float with 16 Bit)',
		help: `// Send comfort, standby, economy mode and buildingProtection temperatures, as n.4 DPT9.001.
	  msg.payload = {comfort:22, standby:21.5, economy:21, buildingProtection:15};
	  return msg;`,
	},

	// DPT9 subtypes
	subtypes: {
		100: {
			name: 'Quadruple setpoints (comfort,standby,economy,buildingProtection) (4 float with 16 Bit)',
			desc: 'DPT_TempRoomSetpSetF16[4]',
			unit: '°C',
			range: [-273, 670760],
		},
	},
}

export default config
