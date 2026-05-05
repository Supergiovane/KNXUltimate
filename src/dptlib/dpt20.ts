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
// DPT20: 1-byte enumeration (N8)
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
		desc: '1-byte enumeration',
		help: `// Send 8-bit enumeration value.
// DPT20.102 - HVAC Mode: 0=Auto, 1=Comfort, 2=Standby, 3=Economy, 4=Building Protection
msg.payload = 1; // Set to Comfort
return msg;`,
		helplink: '',
	},

	subtypes: {
		// ===== Generic =====

		// 20.001 System Clock Mode
		'001': {
			name: 'System Clock Mode',
			desc: 'DPT_SCLOMode',
			unit: '',
			enc: { 0: 'Autonomous', 1: 'Slave', 2: 'Master' },
		},

		// 20.002 Building Mode
		'002': {
			name: 'Building Mode',
			desc: 'DPT_BuildingMode',
			unit: '',
			enc: { 0: 'Building in use', 1: 'Building not used', 2: 'Building protection' },
		},

		// 20.003 Occupancy Mode
		'003': {
			name: 'Occupancy Mode',
			desc: 'DPT_OccMode',
			unit: '',
			enc: { 0: 'Occupied', 1: 'Standby', 2: 'Not occupied' },
		},

		// 20.004 Priority
		'004': {
			name: 'Priority',
			desc: 'DPT_Priority',
			unit: '',
			enc: { 0: 'High', 1: 'Medium', 2: 'Low', 3: 'Void' },
		},

		// 20.005 Light Application Mode
		'005': {
			name: 'Light Application Mode',
			desc: 'DPT_LightApplicationMode',
			unit: '',
			enc: { 0: 'Normal', 1: 'Presence simulation', 2: 'Night round' },
		},

		// 20.006 Application Area
		'006': {
			name: 'Application Area',
			desc: 'DPT_ApplicationArea',
			unit: '',
			enc: {
				0: 'No fault',
				1: 'Common interest',
				10: 'HVAC general FBs',
				11: 'HVAC hot water heating',
				12: 'HVAC direct electrical heating',
				13: 'HVAC terminal units',
				14: 'HVAC VAC',
				20: 'Lighting',
				30: 'Security',
				40: 'Load management',
				50: 'Shutters and blinds',
			},
		},

		// 20.007 Alarm Class Type
		'007': {
			name: 'Alarm Class Type',
			desc: 'DPT_AlarmClassType',
			unit: '',
			enc: { 1: 'Simple alarm', 2: 'Basic alarm', 3: 'Extended alarm' },
		},

		// 20.008 PSU Mode
		'008': {
			name: 'PSU Mode',
			desc: 'DPT_PSUMode',
			unit: '',
			enc: { 0: 'Disabled', 1: 'Enabled', 2: 'Auto' },
		},

		// 20.011 Error Class System
		'011': {
			name: 'Error Class System',
			desc: 'DPT_ErrorClass_System',
			unit: '',
			enc: {
				0: 'No fault',
				1: 'General device fault',
				2: 'Communication fault',
				3: 'Configuration fault',
				4: 'Hardware fault',
				5: 'Software fault',
				6: 'Insufficient non-volatile memory',
				7: 'Insufficient volatile memory',
				8: 'Memory allocation zero',
				9: 'CRC error',
				10: 'Watchdog reset',
				11: 'Invalid opcode',
				12: 'General protection fault',
				13: 'Max table length exceeded',
				14: 'Undefined load command',
				15: 'Group address table not sorted',
				16: 'Invalid connection number',
				17: 'Invalid group object number',
				18: 'Group object type exceeds length',
			},
		},

		// 20.012 Error Class HVAC
		'012': {
			name: 'Error Class HVAC',
			desc: 'DPT_ErrorClass_HVAC',
			unit: '',
			enc: {
				0: 'No fault',
				1: 'Sensor fault',
				2: 'Process/controller fault',
				3: 'Actuator fault',
				4: 'Other fault',
			},
		},

		// 20.013 Time Delay
		'013': {
			name: 'Time Delay',
			desc: 'DPT_Time_Delay',
			unit: '',
			enc: {
				0: 'Not active',
				1: '1 s',
				2: '2 s',
				3: '3 s',
				4: '5 s',
				5: '10 s',
				6: '15 s',
				7: '20 s',
				8: '30 s',
				9: '45 s',
				10: '1 min',
				11: '1.25 min',
				12: '1.5 min',
				13: '2 min',
				14: '2.5 min',
				15: '3 min',
				16: '5 min',
				17: '15 min',
				18: '20 min',
				19: '30 min',
				20: '1 h',
				21: '2 h',
				22: '3 h',
				23: '5 h',
				24: '12 h',
				25: '24 h',
			},
		},

		// 20.014 Beaufort Wind Force Scale
		'014': {
			name: 'Beaufort Wind Force Scale',
			desc: 'DPT_Beaufort_Wind_Force_Scale',
			unit: '',
			enc: {
				0: 'Calm',
				1: 'Light air',
				2: 'Light breeze',
				3: 'Gentle breeze',
				4: 'Moderate breeze',
				5: 'Fresh breeze',
				6: 'Strong breeze',
				7: 'Near gale',
				8: 'Gale',
				9: 'Strong gale',
				10: 'Storm',
				11: 'Violent storm',
				12: 'Hurricane',
			},
		},

		// 20.017 Sensor Select
		'017': {
			name: 'Sensor Select',
			desc: 'DPT_SensorSelect',
			unit: '',
			enc: {
				0: 'Inactive',
				1: 'Digital input',
				2: 'Digital input inverted',
				3: 'Analog input',
				4: 'Temperature sensor input',
			},
		},

		// 20.020 Actuator Connect Type
		'020': {
			name: 'Actuator Connect Type',
			desc: 'DPT_ActuatorConnectType',
			unit: '',
			enc: { 1: 'Sensor connection', 2: 'Controller connection' },
		},

		// 20.021 Cloud Cover
		'021': {
			name: 'Cloud Cover',
			desc: 'DPT_Cloud_Cover',
			unit: '',
			enc: {
				0: 'Cloudless',
				1: 'Sunny',
				2: 'Sunshiny',
				3: 'Lightly cloudy',
				4: 'Scattered clouds',
				5: 'Cloudy',
				6: '6 oktas',
				7: '7 oktas',
				8: 'Overcast',
				9: 'Sky obstructed from view',
			},
		},

		// 20.022 Power Return Mode
		'022': {
			name: 'Power Return Mode',
			desc: 'DPT_PowerReturnMode',
			unit: '',
			enc: {
				0: 'Do not send',
				1: 'Send always',
				2: 'Send if value changed during powerdown',
			},
		},

		// ===== HVAC =====

		// 20.100 Fuel Type
		100: {
			name: 'Fuel Type',
			desc: 'DPT_FuelType',
			unit: '',
			enc: { 0: 'Auto', 1: 'Oil', 2: 'Gas', 3: 'Solid state fuel' },
		},

		// 20.101 Burner Type
		101: {
			name: 'Burner Type',
			desc: 'DPT_BurnerType',
			unit: '',
			enc: { 1: '1 stage', 2: '2 stage', 3: 'Modulating' },
		},

		// 20.102 HVAC Mode
		102: {
			name: 'HVAC Mode',
			desc: 'DPT_HVACMode',
			unit: '',
			enc: {
				0: 'Auto',
				1: 'Comfort',
				2: 'Standby',
				3: 'Economy',
				4: 'Building Protection',
			},
		},

		// 20.103 DHW Mode (Domestic Hot Water)
		103: {
			name: 'DHW Mode',
			desc: 'DPT_DHWMode',
			unit: '',
			enc: {
				0: 'Auto',
				1: 'Legio Protect',
				2: 'Normal',
				3: 'Reduced',
				4: 'Off / Frost Protect',
			},
		},

		// 20.104 Load Priority
		104: {
			name: 'Load Priority',
			desc: 'DPT_LoadPriority',
			unit: '',
			enc: { 0: 'None', 1: 'Shift load priority', 2: 'Absolute load priority' },
		},

		// 20.105 HVAC Control Mode
		105: {
			name: 'HVAC Control Mode',
			desc: 'DPT_HVACContrMode',
			unit: '',
			enc: {
				0: 'Auto',
				1: 'Heat',
				2: 'Morning Warmup',
				3: 'Cool',
				4: 'Night Purge',
				5: 'Precool',
				6: 'Off',
				7: 'Test',
				8: 'Emergency Heat',
				9: 'Fan Only',
				10: 'Free Cool',
				11: 'Ice',
				12: 'Maximum Heating Mode',
				13: 'Economic Heat/Cool Mode',
				14: 'Dehumidification',
				15: 'Calibration Mode',
				16: 'Emergency Cool Mode',
				17: 'Emergency Steam Mode',
				20: 'NoDem',
			},
		},

		// 20.106 HVAC Emergency Mode
		106: {
			name: 'HVAC Emergency Mode',
			desc: 'DPT_HVACEmergMode',
			unit: '',
			enc: {
				0: 'Normal',
				1: 'Emergency Pressure',
				2: 'Emergency Depressure',
				3: 'Emergency Purge',
				4: 'Emergency Shutdown',
				5: 'Emergency Fire',
			},
		},

		// 20.107 Changeover Mode
		107: {
			name: 'Changeover Mode',
			desc: 'DPT_ChangeoverMode',
			unit: '',
			enc: { 0: 'Auto', 1: 'Cooling Only', 2: 'Heating Only' },
		},

		// 20.108 Valve Mode
		108: {
			name: 'Valve Mode',
			desc: 'DPT_ValveMode',
			unit: '',
			enc: {
				1: 'Heat stage A for normal heating',
				2: 'Heat stage B for two-stage heating',
				3: 'Cool stage A for normal cooling',
				4: 'Cool stage B for two-stage cooling',
				5: 'Heat/Cool for changeover applications',
			},
		},

		// 20.109 Damper Mode
		109: {
			name: 'Damper Mode',
			desc: 'DPT_DamperMode',
			unit: '',
			enc: {
				1: 'Fresh air',
				2: 'Supply air',
				3: 'Extract air',
				4: 'Exhaust air',
			},
		},

		// 20.110 Heater Mode
		110: {
			name: 'Heater Mode',
			desc: 'DPT_HeaterMode',
			unit: '',
			enc: {
				1: 'Heat stage A On/Off',
				2: 'Heat stage A Proportional',
				3: 'Heat stage B Proportional',
			},
		},

		// 20.111 Fan Mode
		111: {
			name: 'Fan Mode',
			desc: 'DPT_FanMode',
			unit: '',
			enc: { 0: 'Not running', 1: 'Permanently running', 2: 'Running in intervals' },
		},

		// 20.112 Master/Slave Mode
		112: {
			name: 'Master/Slave Mode',
			desc: 'DPT_MasterSlaveMode',
			unit: '',
			enc: { 0: 'Autonomous', 1: 'Master', 2: 'Slave' },
		},

		// 20.113 Status Room Setpoint
		113: {
			name: 'Status Room Setpoint',
			desc: 'DPT_StatusRoomSetp',
			unit: '',
			enc: {
				0: 'Normal setpoint',
				1: 'Alternative setpoint',
				2: 'Building protection setpoint',
			},
		},

		// 20.114 Metering Device Type
		114: {
			name: 'Metering Device Type',
			desc: 'DPT_Metering_DeviceType',
			unit: '',
			enc: {
				0: 'Other device type',
				1: 'Oil meter',
				2: 'Electricity meter',
				3: 'Gas meter',
				4: 'Heat meter',
				5: 'Steam meter',
				6: 'Warm water meter',
				7: 'Water meter',
				8: 'Heat cost allocator',
				10: 'Cooling load meter (outlet)',
				11: 'Cooling load meter (inlet)',
				12: 'Heat (inlet)',
				13: 'Heat and cool',
				32: 'Breaker (electricity)',
				33: 'Valve (gas or water)',
				40: 'Waste water meter',
				41: 'Garbage',
				255: 'Void device type',
			},
		},

		// 20.115 Humidification/Dehumidification Mode
		115: {
			name: 'Hum/Dehum Mode',
			desc: 'DPT_HumDehumMode',
			unit: '',
			enc: { 0: 'Inactive', 1: 'Humidification', 2: 'Dehumidification' },
		},

		// 20.120 Air Damper Actuator Type
		120: {
			name: 'Air Damper Actuator Type',
			desc: 'DPT_ADAType',
			unit: '',
			enc: { 1: 'Air damper', 2: 'Variable air volume' },
		},

		// 20.121 Backup Mode
		121: {
			name: 'Backup Mode',
			desc: 'DPT_BackupMode',
			unit: '',
			enc: { 0: 'Backup value', 1: 'Keep last state' },
		},

		// 20.122 Start Synchronization
		122: {
			name: 'Start Synchronization',
			desc: 'DPT_StartSynchronization',
			unit: '',
			enc: { 0: 'Position unchanged', 1: 'Single close', 2: 'Single open' },
		},

		// ===== Lighting =====

		// 20.600 Behavior Lock/Unlock
		600: {
			name: 'Behavior Lock/Unlock',
			desc: 'DPT_Behaviour_Lock_Unlock',
			unit: '',
			enc: {
				0: 'Off',
				1: 'On',
				2: 'No change',
				3: 'Value according additional parameter',
				4: 'Memory function value',
				5: 'Updated value',
				6: 'Value before locking',
			},
		},

		// 20.601 Behavior Bus Power Up/Down
		601: {
			name: 'Behavior Bus Power Up/Down',
			desc: 'DPT_Behaviour_Bus_Power_Up_Down',
			unit: '',
			enc: {
				0: 'Off',
				1: 'On',
				2: 'No change',
				3: 'Value according additional parameter',
				4: 'Last value before power down',
			},
		},

		// 20.602 DALI Fade Time
		602: {
			name: 'DALI Fade Time',
			desc: 'DPT_DALI_Fade_Time',
			unit: 's',
			enc: {
				0: '0 s (no fade)',
				1: '0.7 s',
				2: '1.0 s',
				3: '1.4 s',
				4: '2.0 s',
				5: '2.8 s',
				6: '4.0 s',
				7: '5.7 s',
				8: '8.0 s',
				9: '11.3 s',
				10: '16.0 s',
				11: '22.6 s',
				12: '32.0 s',
				13: '45.3 s',
				14: '64.0 s',
				15: '90.5 s',
			},
		},

		// 20.603 Blinking Mode
		603: {
			name: 'Blinking Mode',
			desc: 'DPT_BlinkingMode',
			unit: '',
			enc: { 0: 'Disabled', 1: 'Without acknowledge', 2: 'With acknowledge' },
		},

		// 20.604 Light Control Mode
		604: {
			name: 'Light Control Mode',
			desc: 'DPT_LightControlMode',
			unit: '',
			enc: { 0: 'Automatic', 1: 'Manual' },
		},

		// 20.605 Switch Pushbutton Model
		605: {
			name: 'Switch PB Model',
			desc: 'DPT_SwitchPBModel',
			unit: '',
			enc: { 1: 'One pushbutton', 2: 'Two pushbuttons' },
		},

		// 20.606 Switch Pushbutton Action
		606: {
			name: 'PB Action',
			desc: 'DPT_PBAction',
			unit: '',
			enc: {
				0: 'Inactive (no message sent)',
				1: 'Switch-Off sent',
				2: 'Switch-On sent',
				3: 'Inverse of Info On/Off sent',
			},
		},

		// 20.607 Dimming Sensor Basic Mode
		607: {
			name: 'Dimm PB Model',
			desc: 'DPT_DimmPBModel',
			unit: '',
			enc: {
				1: 'One PB: toggle On/Off',
				2: 'One PB: Dim-Up',
				3: 'One PB: Dim-Down',
				4: 'Two PBs',
			},
		},

		// 20.608 Switch On Mode
		608: {
			name: 'Switch On Mode',
			desc: 'DPT_SwitchOnMode',
			unit: '',
			enc: {
				0: 'Last actual value',
				1: 'Value according additional parameter',
				2: 'Last received absolute setvalue',
			},
		},

		// 20.609 Load Type Set
		609: {
			name: 'Load Type Set',
			desc: 'DPT_LoadTypeSet',
			unit: '',
			enc: { 0: 'Automatic', 1: 'Leading edge (inductive)', 2: 'Trailing edge (capacitive)' },
		},

		// 20.610 Load Type Detected
		610: {
			name: 'Load Type Detected',
			desc: 'DPT_LoadTypeDetected',
			unit: '',
			enc: {
				0: 'Undefined',
				1: 'Leading edge (inductive)',
				2: 'Trailing edge (capacitive)',
				3: 'Detection not possible',
			},
		},

		// 20.611 Converter Test Control
		611: {
			name: 'Converter Test Control',
			desc: 'DPT_Converter_Test_Control',
			unit: '',
			enc: {
				0: 'Reserved',
				1: 'Start function test',
				2: 'Start duration test',
				3: 'Start partial duration test',
				4: 'Stop test',
				5: 'Reset function test done flag',
				6: 'Reset duration test done',
			},
		},

		// 20.612 Converter Control
		612: {
			name: 'Converter Control',
			desc: 'DPT_SABExcept_Behaviour',
			unit: '',
			enc: {
				0: 'Restore factory default settings',
				1: 'Go to rest mode',
				2: 'Go to inhibit mode',
				3: 'Re-light / reset inhibit',
				4: 'Reset lamp time',
			},
		},

		// 20.613 Converter Data Request
		613: {
			name: 'Converter Data Request',
			desc: 'DPT_SABBehaviour_Lock_Unlock',
			unit: '',
			enc: {
				0: 'Reserved',
				1: 'Request converter status',
				2: 'Request converter test result',
				3: 'Request battery info',
				4: 'Request converter FT info',
				5: 'Request converter DT info',
				6: 'Request converter PDT info',
				7: 'Request converter info',
				8: 'Request converter info fix',
			},
		},

		// ===== Shutter/Blinds =====

		// 20.801 SAB Exception Behavior
		801: {
			name: 'SAB Exception Behavior',
			desc: 'DPT_SABExceptBehaviour',
			unit: '',
			enc: {
				0: 'Up',
				1: 'Down',
				2: 'No change',
				3: 'Value according additional parameter',
				4: 'Stop',
			},
		},

		// 20.802 SAB Behavior Lock/Unlock
		802: {
			name: 'SAB Behavior Lock/Unlock',
			desc: 'DPT_SABBehaviour_Lock_Unlock',
			unit: '',
			enc: {
				0: 'Up',
				1: 'Down',
				2: 'No change',
				3: 'Value according additional parameter',
				4: 'Stop',
				5: 'Updated value',
				6: 'Value before locking',
			},
		},

		// 20.803 SSSB Mode (Shutter/Blinds Sensor Basic Mode)
		803: {
			name: 'SSSB Mode',
			desc: 'DPT_SSSBMode',
			unit: '',
			enc: {
				1: 'One PB: toggle Up/Down',
				2: 'One PB: Move-Up',
				3: 'One PB: Move-Down',
				4: 'Two PBs',
			},
		},

		// 20.804 Blinds Control Mode
		804: {
			name: 'Blinds Control Mode',
			desc: 'DPT_BlindsControlMode',
			unit: '',
			enc: { 0: 'Automatic control', 1: 'Manual control' },
		},

		// ===== System =====

		// 20.1000 Communication Mode
		1000: {
			name: 'Communication Mode',
			desc: 'DPT_CommMode',
			unit: '',
			enc: {
				0: 'Data link layer',
				1: 'Busmonitor',
				2: 'Raw frames',
				6: 'cEMI transport layer',
				255: 'No layer',
			},
		},

		// 20.1001 Additional Info Type
		1001: {
			name: 'Additional Info Type',
			desc: 'DPT_AddInfoTypes',
			unit: '',
			enc: {
				0: 'Reserved',
				1: 'PL medium DoA',
				2: 'RF control and S/N or DoA',
				3: 'Busmonitor error flags',
				4: 'Relative timestamp',
				5: 'Time delay',
				6: 'Extended relative timestamp',
				7: 'BiBat information',
			},
		},

		// 20.1002 RF Mode Select
		1002: {
			name: 'RF Mode Select',
			desc: 'DPT_RF_ModeSelect',
			unit: '',
			enc: { 0: 'Asynchronous', 1: 'BiBat master', 2: 'BiBat slave' },
		},

		// 20.1003 RF Filter Select
		1003: {
			name: 'RF Filter Select',
			desc: 'DPT_RF_FilterSelect',
			unit: '',
			enc: {
				0: 'No filter',
				1: 'Filtering by DoA',
				2: 'Filtering by KNX S/N table',
				3: 'Filtering by DoA and S/N table',
			},
		},

		// 20.1004 Medium
		1004: {
			name: 'Medium',
			desc: 'DPT_Medium',
			unit: '',
			enc: { 0: 'KNX TP1', 1: 'KNX PL110', 2: 'KNX RF', 5: 'KNX IP' },
		},

		// ===== Metering =====

		// 20.1200 M-Bus Breaker/Valve State
		1200: {
			name: 'M-Bus Breaker/Valve State',
			desc: 'DPT_MBusBreakerValveState',
			unit: '',
			enc: { 0: 'Closed', 1: 'Open', 2: 'Released', 255: 'Invalid' },
		},

		// 20.1202 Gas Measurement Condition
		1202: {
			name: 'Gas Measurement Condition',
			desc: 'DPT_GasMeasurementCondition',
			unit: '',
			enc: {
				0: 'Unknown',
				1: 'Temperature converted',
				2: 'At base condition',
				3: 'At measurement condition',
			},
		},
	},
}

export default config
