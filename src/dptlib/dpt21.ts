/**
 * Provides KNX Data Point Type 21 encoding and decoding helpers.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

/**

* (C) 2022 Supergiovane
*/

import { module } from '../KnxLog'
import type { DatapointConfig } from '.'
import { hasProp } from '../utils'

// Structure of DPT 21.xxx: b7b6b5b4b3b2b1b0
// Bit 0: outOfService
// Bit 1: fault
// Bit 2: overridden
// Bit 3: inAlarm
// Bit 4: alarmUnAck
// Bit 5: reserved (0)
// Bit 6: reserved (0)
// Bit 7: reserved (0)

// DPT 21.102 DPT_StatusRHC (03.07.02 §4.4.3), bit 0 first, as XKNX
const STATUS_RHC_FIELDS = [
	'fault',
	'statusEco',
	'tempFlowLimit',
	'tempReturnLimit',
	'statusMorningBoost',
	'statusStartOptim',
	'statusStopOptim',
	'summerMode',
]

const logger = module('DPT21')

const config: DatapointConfig = {
	id: 'DPT21',
	formatAPDU: (value, context) => {
		// The legacy layout uses the 21.001 fields for every subtype
		if (context?.strict && context.subtypeid === '102') {
			if (typeof value !== 'object' || value === null) {
				throw new Error(
					`Must supply an object of {${STATUS_RHC_FIELDS.join(', ')}}`,
				)
			}
			let bits = 0
			STATUS_RHC_FIELDS.forEach((field, bit) => {
				if (value[field] === undefined) return
				if (typeof value[field] !== 'boolean') {
					throw new Error(`${field} must be a boolean`)
				}
				if (value[field]) bits |= 1 << bit
			})
			return Buffer.from([bits])
		}
		if (!value) {
			logger.error('cannot write null value')
			return null
		}
		if (
			typeof value === 'object' &&
			hasProp(value, 'outOfService') &&
			typeof value.outOfService === 'boolean' &&
			hasProp(value, 'fault') &&
			typeof value.fault === 'boolean' &&
			hasProp(value, 'overridden') &&
			typeof value.overridden === 'boolean' &&
			hasProp(value, 'inAlarm') &&
			typeof value.inAlarm === 'boolean' &&
			hasProp(value, 'alarmUnAck') &&
			typeof value.alarmUnAck === 'boolean'
		) {
			const bitVal = parseInt(
				`0000${value.alarmUnAck ? '1' : '0'}${
					value.inAlarm ? '1' : '0'
				}${value.overridden ? '1' : '0'}${
					value.fault ? '1' : '0'
				}${value.outOfService ? '1' : '0'}`,
				2,
			)
			return Buffer.from([bitVal])
		}
		logger.error(
			'Must supply a right payload: {outOfService:true-false, fault:true-false, overridden:true-false, inAlarm:true-false, alarmUnAck:true-false}',
		)
		return null
	},

	fromBuffer: (buf, context) => {
		if (buf.length !== 1) {
			logger.debug('Buffer should be 8 bit long, got', buf.length)
			return null
		}
		if (context?.strict && context.subtypeid === '102') {
			const status: Record<string, boolean> = {}
			STATUS_RHC_FIELDS.forEach((field, bit) => {
				status[field] = (buf[0] & (1 << bit)) !== 0
			})
			return status
		}
		const sBit = Array.from(
			parseInt(buf.toString('hex').toUpperCase(), 16)
				.toString(2)
				.padStart(8, '0'),
		) // Get bit from hex
		const ret = {
			outOfService: sBit[7] === '1',
			fault: sBit[6] === '1',
			overridden: sBit[5] === '1',
			inAlarm: sBit[4] === '1',
			alarmUnAck: sBit[3] === '1',
		}
		return ret
	},

	basetype: {
		bitlength: 8,
		valuetype: 'basic',
		desc: 'General Status',
		help: `// This represents a general status
// outOfService:true-false, fault:true-false, overridden:true-false, inAlarm:true-false, alarmUnAck:true-false
msg.payload={outOfService:false, fault:false, overridden:false, inAlarm:true, alarmUnAck:false};
return msg;`,
		helplink: '',
	},

	subtypes: {
		'001': {
			desc: 'outOfService:true-false, fault:true-false, overridden:true-false, inAlarm:true-false, alarmUnAck:true-false',
			name: 'General Status',
			unit: '',
			scalar_range: [,],
			range: [,],
		},
		'002': {
			desc: 'DPT_Device_Control',
			name: 'Device Control',
			unit: '',
			scalar_range: [,],
			range: [,],
		},
		'100': {
			desc: 'DPT_ForceSign',
			name: 'Force Sign',
			unit: '',
			scalar_range: [,],
			range: [,],
		},
		'101': {
			desc: 'DPT_ForceSignCool',
			name: 'Force Sign Cool',
			unit: '',
			scalar_range: [,],
			range: [,],
		},
		'102': {
			desc: 'DPT_StatusRHC',
			name: 'Room Heating Controller Status',
			unit: '',
			scalar_range: [,],
			range: [,],
		},
		'103': {
			desc: 'DPT_StatusSDHWC',
			name: 'Solar DHW Controller Status',
			unit: '',
			scalar_range: [,],
			range: [,],
		},
		'104': {
			desc: 'DPT_FuelTypeSet',
			name: 'Fuel Type Set',
			unit: '',
			scalar_range: [,],
			range: [,],
		},
		'105': {
			desc: 'DPT_StatusRCC',
			name: 'Room Cooling Controller Status',
			unit: '',
			scalar_range: [,],
			range: [,],
		},
		'106': {
			desc: 'DPT_StatusAHU',
			name: 'Ventilation Controller Status',
			unit: '',
			scalar_range: [,],
			range: [,],
		},
		'601': {
			desc: 'DPT_LightActuatorErrorInfo',
			name: 'Lighting Actuator Error Information',
			unit: '',
			scalar_range: [,],
			range: [,],
		},
		'1000': {
			desc: 'DPT_RF_ModeInfo',
			name: 'RF Communication Mode Info',
			unit: '',
			scalar_range: [,],
			range: [,],
		},
		'1001': {
			desc: 'DPT_RF_FilterInfo',
			name: 'RF Filter Info',
			unit: '',
			scalar_range: [,],
			range: [,],
		},
		'1002': {
			desc: 'DPT_Security_Report',
			name: 'Security Report',
			unit: '',
			scalar_range: [,],
			range: [,],
		},
		'1010': {
			desc: 'DPT_Channel_Activation_8',
			name: 'Channel Activation for 8 channels',
			unit: '',
			scalar_range: [,],
			range: [,],
		},
		'1200': {
			desc: 'DPT_VirtualDryContact',
			name: 'Virtual Dry Contact',
			unit: '',
			scalar_range: [,],
			range: [,],
		},
		'1201': {
			desc: 'DPT_Phases_Status',
			name: 'Phases Status',
			unit: '',
			scalar_range: [,],
			range: [,],
		},
	},
}

export default config
