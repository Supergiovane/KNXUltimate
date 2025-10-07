/**
 * Provides KNX Data Point Type 20 encoding and decoding helpers.
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
import { module } from '../KnxLog'

//
// DPT20: 1-byte HVAC
//

const logger = module('DPT20')

const config: DatapointConfig = {
	id: 'DPT20',
	formatAPDU: (value) => {
		const apdu_data = Buffer.alloc(1)
		apdu_data[0] = value
		logger.debug(
			`./knx/src/dpt20.js : input value = ${value}   apdu_data = ${apdu_data}`,
		)
		return apdu_data
	},

	fromBuffer: (buf) => {
		if (buf.length !== 1) {
			logger.warn('Buffer should be 1 byte long, got', buf.length)
			return null
		}
		const ret = buf.readUInt8(0)
		return ret
	},

	basetype: {
		bitlength: 8,
		range: [,],
		valuetype: 'basic',
		desc: '1-byte',
		help: `// Send Value. Examples for DPT20 (1-byte HVAC):
// DPT20.102 - HVAC Mode: 0 = Auto, 1 = Comfort, 2 = Standby, 3 = Economy, 4 = Building protection
msg.payload = 1; // Set to Comfort
return msg;

// DPT20.103 - HVAC Control Mode: 0 = Auto, 1 = Heat, 2 = Cool, 3 = Fan only, 4 = Dry
msg.payload = 2; // Set to Cool
return msg;

// DPT20.104 - HVAC Emergency Mode: 0 = Normal, 1 = Emergency
msg.payload = 1; // Set to Emergency
return msg;

// DPT20.105 - HVAC Changeover Mode: 0 = Auto, 1 = Heating, 2 = Cooling
msg.payload = 1; // Set to Heating
return msg;

// DPT20.106 - HVAC Valve Mode: 0 = Auto, 1 = Open, 2 = Closed
msg.payload = 2; // Set to Closed
return msg;

// DPT20.107 - HVAC Damper Mode: 0 = Auto, 1 = Open, 2 = Closed
msg.payload = 1; // Set to Open
return msg;

// DPT20.108 - HVAC Heater Mode: 0 = Auto, 1 = On, 2 = Off
msg.payload = 1; // Set to On
return msg;

// DPT20.109 - HVAC Fan Mode: 0 = Auto, 1 = Low, 2 = Medium, 3 = High
msg.payload = 3; // Set to High
return msg;

// DPT20.110 - HVAC Master/Slave Mode: 0 = Master, 1 = Slave
msg.payload = 0; // Set to Master
return msg;

// DPT20.111 - HVAC Room Temperature Setpoint: Value in °C (e.g., 22 for 22°C)
msg.payload = 22; // Set to 22°C
return msg;`,
		helplink: '',
	},

	subtypes: {
		// 20.102 HVAC mode
		102: {
			name: 'HVAC Mode',
			desc: 'HVAC mode control',
			unit: '',
			scalar_range: [,],
			range: [,],
		},

		// 20.103 HVAC Control Mode
		103: {
			name: 'HVAC Control Mode',
			desc: 'HVAC control mode',
			unit: '',
			scalar_range: [,],
			range: [,],
		},

		// 20.104 HVAC Emergency Mode
		104: {
			name: 'HVAC Emergency Mode',
			desc: 'HVAC emergency mode',
			unit: '',
			scalar_range: [,],
			range: [,],
		},

		// 20.105 HVAC Changeover Mode
		105: {
			name: 'HVAC Changeover Mode',
			desc: 'HVAC changeover mode',
			unit: '',
			scalar_range: [,],
			range: [,],
		},

		// 20.106 HVAC Valve Mode
		106: {
			name: 'HVAC Valve Mode',
			desc: 'HVAC valve mode',
			unit: '',
			scalar_range: [,],
			range: [,],
		},

		// 20.107 HVAC Damper Mode
		107: {
			name: 'HVAC Damper Mode',
			desc: 'HVAC damper mode',
			unit: '',
			scalar_range: [,],
			range: [,],
		},

		// 20.108 HVAC Heater Mode
		108: {
			name: 'HVAC Heater Mode',
			desc: 'HVAC heater mode',
			unit: '',
			scalar_range: [,],
			range: [,],
		},

		// 20.109 HVAC Fan Mode
		109: {
			name: 'HVAC Fan Mode',
			desc: 'HVAC fan mode',
			unit: '',
			scalar_range: [,],
			range: [,],
		},

		// 20.110 HVAC Master/Slave Mode
		110: {
			name: 'HVAC Master/Slave Mode',
			desc: 'HVAC master/slave mode',
			unit: '',
			scalar_range: [,],
			range: [,],
		},

		// 20.111 HVAC Room Temperature Setpoint
		111: {
			name: 'HVAC Room Temperature Setpoint',
			desc: 'HVAC room temperature setpoint',
			unit: '°C',
			scalar_range: [,],
			range: [,],
		},
	},
}

export default config
