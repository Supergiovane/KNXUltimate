/**
 * knx.js - a KNX protocol stack in pure Javascript
 * (C) 2016-2018 Elias Karakoulakis
 */

import Log from '../KnxLog'
import type { DatapointConfig } from '.'
import { hasProp } from '../utils'
import dpt9 from './dpt9'

//
// 4x DPT9.* 2-byte floating point value
//
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
		Log.get().error(
			'DPT275.formatAPDU: Must supply all values, for example {comfort:22, standby:21.5, economy:21, buildingProtection:15}',
		)
	},
	fromBuffer(buf) {
		// Get the telegram from the KNX bus and create a javascript object.
		if (buf.length !== 8) {
			Log.get().warn(
				'DPT275.fromBuffer: buf should be 8 bytes long (got %d bytes)',
				buf.length,
			)
			return null
		}
		const comfort = dpt9.fromBuffer(buf.slice(0, 2))
		const standby = dpt9.fromBuffer(buf.slice(2, 4))
		const economy = dpt9.fromBuffer(buf.slice(4, 6))
		const buildingProtection = dpt9.fromBuffer(buf.slice(6, 8))
		return {
			comfort,
			standby,
			economy,
			buildingProtection,
		}
	},

	// DPT275 basetype info
	basetype: {
		bitlength: 64,
		valuetype: 'basic',
		desc: 'Quadruple setpoints (comfort,standby,economy,buildingProtection) (4 float with 16 Bit)',
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
