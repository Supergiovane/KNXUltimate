/**
 * knx.js - a KNX protocol stack in pure Javascript
 * (C) 2016-2018 Elias Karakoulakis
 */

import Log from '../KnxLog'
import type { DatapointConfig } from '.'
import { hasProp, hex2bin } from '../utils'

//
// DPT235: DPT_Tariff_ActiveEnergy
//

// 08/09/2020 Supergiovane
// Send to BUS
const config: DatapointConfig = {
	id: 'DPT235',
	formatAPDU(value) {
		try {
			const apdu_data = Buffer.alloc(6) // 3 x 2 bytes

			if (
				typeof value === 'object' &&
				hasProp(value, 'activeElectricalEnergy') &&
				hasProp(value, 'tariff') &&
				hasProp(value, 'validityTariff') &&
				hasProp(value, 'validityEnergy')
			) {
				// activeElectricalEnergy
				const nbuff = Buffer.alloc(4)
				nbuff.writeInt32BE(value.activeElectricalEnergy)
				apdu_data[0] = nbuff[0]
				apdu_data[1] = nbuff[1]
				apdu_data[2] = nbuff[2]
				apdu_data[3] = nbuff[3]

				// tariff
				const tariff = parseInt(value.tariff)
				apdu_data[4] = tariff

				// Validity
				const validity = parseInt(
					`000000${
						value.validityTariff ? '1' : '0'
					}${value.validityEnergy ? '1' : '0'}`,
					2,
				)
				apdu_data[5] = validity
				return apdu_data
			}
			Log.get().error(
				'DPT235: Must supply a payload like, for example: {activeElectricalEnergy:1540, tariff:20, validityTariff:true, validityEnergy:true}',
			)
		} catch (error) {
			Log.get().error(`DPT235: exports.formatAPDU error ${error.message}`)
		}
	},

	// RX from BUS
	fromBuffer(buf) {
		try {
			// Preparo per l'avvento di Gozer il gozeriano.
			const activeElectricalEnergy = buf.subarray(0, 4).readInt32BE() // First 4x8 bits signed integer
			const tariff = parseInt(buf.subarray(4, 5)[0] as any) // next 8 bit unsigned value
			const validity = hex2bin(buf.subarray(5, 6)[0].toString(16)) // Next 8 bit, only the latest 2 bits are used.
			const validityTariff = validity.substring(6, 7) === '1'
			const validityEnergy = validity.substring(7, 8) === '1'
			return {
				activeElectricalEnergy,
				tariff,
				validityTariff,
				validityEnergy,
			}
		} catch (error) {
			Log.get().error(`DPT235: exports.fromBuffer error ${error.message}`)
		}
	},

	// DPT basetype info
	basetype: {
		bitlength: 48,
		valuetype: 'basic',
		desc: '6 octect Tariff_ActiveEnergy',
	},

	// DPT subtypes
	subtypes: {
		'001': {
			desc: 'DPT_Tariff_ActiveEnergy',
			name: 'Tariff of active Energy (Energy+Tariff+Validity)',
			unit: 'Tariff',
		},
	},
}

export default config
