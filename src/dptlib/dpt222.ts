/**
 * KNXEngine - a KNX protocol stack in Javascript
 * (C) 2020 Supergiovane
 */

import { getFloat, getHex, hasProp } from '../utils'
import type { DatapointConfig } from '.'
import { module } from '../KnxLog'

//
// DPT222: Data Type 3x 16-Float Value
//

// 08/09/2020 Supergiovane
// Send to BUS

const logger = module('DPT222')

const config: DatapointConfig = {
	id: 'DPT222',
	formatAPDU: (value) => {
		const apdu_data = Buffer.alloc(6) // 3 x 2 bytes

		if (
			typeof value === 'object' &&
			hasProp(value, 'Comfort') &&
			value.Comfort >= -273 &&
			value.Comfort <= 670760 &&
			hasProp(value, 'Standby') &&
			value.Standby >= -273 &&
			value.Standby <= 670760 &&
			hasProp(value, 'Economy') &&
			value.Economy >= -273 &&
			value.Economy <= 670760
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
			return apdu_data
		}
		logger.error(
			'DPT222: Must supply a payload like, for example: {Comfort:21, Standby:20, Economy:14}',
		)
		return null
	},

	// RX from BUS
	fromBuffer: (buf) => {
		if (buf.length !== 6) {
			logger.warn(
				'DPT222.fromBuffer: buf should be 3x2 bytes long (got %d bytes)',
				buf.length,
			)
			return null
		}
		// Preparo per l'avvento di Gozer il gozeriano.
		const fComfort = getFloat(buf[0], buf[1])
		const fStandby = getFloat(buf[2], buf[3])
		const fEconomy = getFloat(buf[4], buf[5])
		return { Comfort: fComfort, Standby: fStandby, Economy: fEconomy }
	},

	// DPT222 basetype info
	basetype: {
		bitlength: 48,
		valuetype: 'basic',
		desc: '3x16-bit floating point value',
		help: `// Set the temperature setpoints or setpoint shift
msg.payload = {Comfort:21.4, Standby:20, Economy:18.2};
return msg;`,
		helplink:
			'https://github.com/Supergiovane/node-red-contrib-knx-ultimate/wiki/-Sample---DPT222',
	},

	// DPT222 subtypes
	subtypes: {
		// 222.100 RoomTemperature Setpoint Values
		100: {
			desc: 'DPT_TempRoomSetpSetF16[3]',
			name: 'Room temperature setpoint (Comfort, Standby and Economy)',
			unit: '°C',
			range: [-273, 670760],
		},

		// 222.101 RoomTemperature Setpoint Shift Values
		101: {
			desc: 'DPT_TempRoomSetpSetShiftF16[3]',
			name: 'Room temperature setpoint shift (Comfort, Standby and Economy)',
			unit: 'K',
			range: [-670760, 670760],
		},
	},
}

export default config
