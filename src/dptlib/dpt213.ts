/**
 * KNXEngine - a KNX protocol stack in Javascript
 * (C) 2020 Supergiovane
 */

import Log from '../KnxLog'
import type { DatapointConfig } from '.'
import { hasProp, getHex, getFloat } from '../utils'

//
// DPT213: Data Type 4x 16-Signed Value
//

// 07/01/2021 Supergiovane
// Send to BUS
const config: DatapointConfig = {
	id: 'DPT213',
	formatAPDU(value) {
		const apdu_data = Buffer.alloc(8) // 4 x 2 bytes

		if (
			typeof value === 'object' &&
			hasProp(value, 'Comfort') &&
			value.Comfort >= -272 &&
			value.Comfort <= 655.34 &&
			hasProp(value, 'Standby') &&
			value.Standby >= -272 &&
			value.Standby <= 655.34 &&
			hasProp(value, 'Economy') &&
			value.Economy >= -272 &&
			value.Economy <= 655.34 &&
			hasProp(value, 'BuildingProtection') &&
			value.BuildingProtection >= -272 &&
			value.BuildingProtection <= 655.34
		) {
			// Comfort
			const ArrComfort = getHex(value.Comfort)
			apdu_data[0] = ArrComfort[0]
			apdu_data[1] = ArrComfort[1]

			// Standby
			const ArrStandby = getHex(value.Standby)
			apdu_data[2] = ArrStandby[0]
			apdu_data[3] = ArrStandby[1]

			// Economy
			const ArrEconomy = getHex(value.Economy)
			apdu_data[4] = ArrEconomy[0]
			apdu_data[5] = ArrEconomy[1]

			// BuildingProtection
			const ArrBuildingProtection = getHex(value.BuildingProtection)
			apdu_data[6] = ArrBuildingProtection[0]
			apdu_data[7] = ArrBuildingProtection[1]
			return apdu_data
		}
		Log.get().error(
			'DPT213: Must supply a payload like, for example: {Comfort:21, Standby:20, Economy:14, BuildingProtection:8}',
		)
	},

	// RX from BUS
	fromBuffer(buf) {
		if (buf.length !== 8) {
			Log.get().warn(
				'DPT213.fromBuffer: buf should be 4x2 bytes long (got %d bytes)',
				buf.length,
			)
			return null
		}
		// Preparo per l'avvento di Gozer il gozeriano.
		const nComfort = getFloat(buf[0], buf[1])
		const nStandby = getFloat(buf[2], buf[3])
		const nEconomy = getFloat(buf[4], buf[5])
		const nbProt = getFloat(buf[6], buf[7])
		return {
			Comfort: nComfort,
			Standby: nStandby,
			Economy: nEconomy,
			BuildingProtection: nbProt,
		}
	},

	// DPT213 basetype info
	basetype: {
		bitlength: 4 * 16,
		valuetype: 'basic',
		desc: '4x 16-Bit Signed Value',
		help: `// Sample of 213.100.
// Set the temperatures between -272°C and 655.34°C with 0,02°C of resolution.
// These 4 property names, are valid for 213.101, 213.102 etc... as well.
// For example, for 213.101, LegioProtect is the "Comfort" property, Normal is "Standby", etc...
msg.payload = {Comfort:21.4, Standby:20, Economy:18.2, BuildingProtection:-1};
return msg;`,
		helplink:
			'https://github.com/Supergiovane/node-red-contrib-knx-ultimate/wiki/-Sample---DPT213',
	},

	// DPT213 subtypes
	subtypes: {
		100: {
			desc: 'DPT_TempRoomSetpSet[4]',
			name: 'Room temperature setpoint (Comfort, Standby, Economy, Building protection)',
			unit: '°C',
			range: [-272, 655.34],
		},
		101: {
			desc: 'DPT_TempDHWSetpSet[4]',
			name: 'Room temperature setpoint DHW (LegioProtect, Normal, Reduced, Off/FrostProtect)',
			unit: '°C',
			range: [-272, 655.34],
		},
		102: {
			desc: 'DPT_TempRoomSetpSetShift[4]',
			name: 'Room temperature setpoint shift (Comfort, Standby, Economy, Building protection)',
			unit: '°C',
			range: [-272, 655.34],
		},
	},
}

export default config
