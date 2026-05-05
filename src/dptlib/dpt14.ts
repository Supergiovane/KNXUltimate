/**
 * Provides KNX Data Point Type 14 encoding and decoding helpers.
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
// DPT14.*: 4-byte floating point value
//

/* In sharp contrast to DPT9 (16-bit floating point - JS spec does not support),
 *  the case for 32-bit floating point is simple...
 */

const logger = module('DPT14')
const MAX_FLOAT32 = 3.4028234663852886e38

function isDebugEnabled(): boolean {
	if (typeof logger.isLevelEnabled === 'function') {
		return logger.isLevelEnabled('debug')
	}
	return logger.level === 'debug'
}

function errorDebugOnly(message: string, ...args: unknown[]): void {
	if (isDebugEnabled()) logger.error(message, ...args)
}

function warnDebugOnly(message: string, ...args: unknown[]): void {
	if (isDebugEnabled()) logger.warn(message, ...args)
}

const config: DatapointConfig = {
	id: 'DPT14',
	formatAPDU: (value, context) => {
		const logSuffix = context?.logSuffix || ''
		const inputType = typeof value
		let normalizedValue = value

		if (inputType !== 'number' || !Number.isFinite(value)) {
			errorDebugOnly(
				`Must supply a finite number value. Will emit 0${logSuffix}`,
			)
			logger.debug(
				`formatAPDU invalid input: input=%j inputType=%s finite=%s${logSuffix}`,
				value,
				inputType,
				Number.isFinite(value),
			)
			normalizedValue = 0
		}

		if (normalizedValue > MAX_FLOAT32 || normalizedValue < -MAX_FLOAT32) {
			const clampedValue =
				normalizedValue > 0 ? MAX_FLOAT32 : -MAX_FLOAT32
			errorDebugOnly(
				`Value out of float32 range (${normalizedValue}). Clamping to ${clampedValue}${logSuffix}`,
			)
			logger.debug(
				`formatAPDU range clamp: input=%j normalized=%d clamped=%d max=%d${logSuffix}`,
				value,
				normalizedValue,
				clampedValue,
				MAX_FLOAT32,
			)
			normalizedValue = clampedValue
		}

		const apdu_data = Buffer.alloc(4)
		apdu_data.writeFloatBE(normalizedValue, 0)
		logger.debug(
			`formatAPDU encoded: input=%j normalized=%d apdu=${apdu_data.toString('hex')}${logSuffix}`,
			value,
			normalizedValue,
		)
		return apdu_data
	},

	fromBuffer: (buf) => {
		if (!Buffer.isBuffer(buf)) {
			warnDebugOnly(`Buffer expected, got type=${typeof buf}`)
			return null
		}
		if (buf.length !== 4) {
			warnDebugOnly(
				`Buffer should be 4 bytes long, got ${buf.length}. buf=${buf.toString('hex')}`,
			)
			return null
		}
		const decodedValue = buf.readFloatBE(0)
		logger.debug(
			`fromBuffer decoded: value=${decodedValue} buf=${buf.toString('hex')}`,
		)
		return decodedValue
	},

	// DPT14 base type info
	basetype: {
		bitlength: 32,
		valuetype: 'basic',
		range: [-MAX_FLOAT32, MAX_FLOAT32],
		desc: '32-bit floating point value',
		help: `// Send 32-bit floating point value.
msg.payload = 42;
return msg;`,
	},

	// DPT14 subtypes info (complete per KNX standard)
	subtypes: {
		'000': {
			desc: 'DPT_Value_Acceleration',
			name: 'Acceleration',
			unit: 'm/s²',
		},
		'001': {
			desc: 'DPT_Value_Acceleration_Angular',
			name: 'Angular acceleration',
			unit: 'rad/s²',
		},
		'002': {
			desc: 'DPT_Value_Activation_Energy',
			name: 'Activation energy',
			unit: 'J/mol',
		},
		'003': {
			desc: 'DPT_Value_Activity',
			name: 'Radioactive activity',
			unit: 'Bq',
		},
		'004': {
			desc: 'DPT_Value_Mol',
			name: 'Amount of substance',
			unit: 'mol',
		},
		'005': {
			desc: 'DPT_Value_Amplitude',
			name: 'Amplitude',
			unit: '',
		},
		'006': {
			desc: 'DPT_Value_AngleRad',
			name: 'Angle, radian',
			unit: 'rad',
		},
		'007': {
			desc: 'DPT_Value_AngleDeg',
			name: 'Angle, degree',
			unit: '°',
		},
		'008': {
			desc: 'DPT_Value_Angular_Momentum',
			name: 'Angular momentum',
			unit: 'J·s',
		},
		'009': {
			desc: 'DPT_Value_Angular_Velocity',
			name: 'Angular velocity',
			unit: 'rad/s',
		},
		'010': {
			desc: 'DPT_Value_Area',
			name: 'Area',
			unit: 'm²',
		},
		'011': {
			desc: 'DPT_Value_Capacitance',
			name: 'Capacitance',
			unit: 'F',
		},
		'012': {
			desc: 'DPT_Value_Charge_DensitySurface',
			name: 'Charge density (surface)',
			unit: 'C/m²',
		},
		'013': {
			desc: 'DPT_Value_Charge_DensityVolume',
			name: 'Charge density (volume)',
			unit: 'C/m³',
		},
		'014': {
			desc: 'DPT_Value_Compressibility',
			name: 'Compressibility',
			unit: 'm²/N',
		},
		'015': {
			desc: 'DPT_Value_Conductance',
			name: 'Conductance',
			unit: 'S',
		},
		'016': {
			desc: 'DPT_Value_Electrical_Conductivity',
			name: 'Electrical conductivity',
			unit: 'S/m',
		},
		'017': {
			desc: 'DPT_Value_Density',
			name: 'Density',
			unit: 'kg/m³',
		},
		'018': {
			desc: 'DPT_Value_Electric_Charge',
			name: 'Electric charge',
			unit: 'C',
		},
		'019': {
			desc: 'DPT_Value_Electric_Current',
			name: 'Electric current',
			unit: 'A',
		},
		'020': {
			desc: 'DPT_Value_Electric_CurrentDensity',
			name: 'Electric current density',
			unit: 'A/m²',
		},
		'021': {
			desc: 'DPT_Value_Electric_DipoleMoment',
			name: 'Electric dipole moment',
			unit: 'C·m',
		},
		'022': {
			desc: 'DPT_Value_Electric_Displacement',
			name: 'Electric displacement',
			unit: 'C/m²',
		},
		'023': {
			desc: 'DPT_Value_Electric_FieldStrength',
			name: 'Electric field strength',
			unit: 'V/m',
		},
		'024': {
			desc: 'DPT_Value_Electric_Flux',
			name: 'Electric flux',
			unit: 'C',
		},
		'025': {
			desc: 'DPT_Value_Electric_FluxDensity',
			name: 'Electric flux density',
			unit: 'C/m²',
		},
		'026': {
			desc: 'DPT_Value_Electric_Polarization',
			name: 'Electric polarization',
			unit: 'C/m²',
		},
		'027': {
			desc: 'DPT_Value_Electric_Potential',
			name: 'Electric potential',
			unit: 'V',
		},
		'028': {
			desc: 'DPT_Value_Electric_PotentialDifference',
			name: 'Electric potential difference',
			unit: 'V',
		},
		'029': {
			desc: 'DPT_Value_ElectromagneticMoment',
			name: 'Electromagnetic moment',
			unit: 'A·m²',
		},
		'030': {
			desc: 'DPT_Value_Electromotive_Force',
			name: 'Electromotive force',
			unit: 'V',
		},
		'031': {
			desc: 'DPT_Value_Energy',
			name: 'Energy',
			unit: 'J',
		},
		'032': {
			desc: 'DPT_Value_Force',
			name: 'Force',
			unit: 'N',
		},
		'033': {
			desc: 'DPT_Value_Frequency',
			name: 'Frequency',
			unit: 'Hz',
		},
		'034': {
			desc: 'DPT_Value_Angular_Frequency',
			name: 'Angular frequency',
			unit: 'rad/s',
		},
		'035': {
			desc: 'DPT_Value_Heat_Capacity',
			name: 'Heat capacity',
			unit: 'J/K',
		},
		'036': {
			desc: 'DPT_Value_Heat_FlowRate',
			name: 'Heat flow rate',
			unit: 'W',
		},
		'037': {
			desc: 'DPT_Value_Heat_Quantity',
			name: 'Heat quantity',
			unit: 'J',
		},
		'038': {
			desc: 'DPT_Value_Impedance',
			name: 'Impedance',
			unit: 'Ω',
		},
		'039': {
			desc: 'DPT_Value_Length',
			name: 'Length',
			unit: 'm',
		},
		'040': {
			desc: 'DPT_Value_Light_Quantity',
			name: 'Light quantity',
			unit: 'lm·s',
		},
		'041': {
			desc: 'DPT_Value_Luminance',
			name: 'Luminance',
			unit: 'cd/m²',
		},
		'042': {
			desc: 'DPT_Value_Luminous_Flux',
			name: 'Luminous flux',
			unit: 'lm',
		},
		'043': {
			desc: 'DPT_Value_Luminous_Intensity',
			name: 'Luminous intensity',
			unit: 'cd',
		},
		'044': {
			desc: 'DPT_Value_Magnetic_FieldStrength',
			name: 'Magnetic field strength',
			unit: 'A/m',
		},
		'045': {
			desc: 'DPT_Value_Magnetic_Flux',
			name: 'Magnetic flux',
			unit: 'Wb',
		},
		'046': {
			desc: 'DPT_Value_Magnetic_FluxDensity',
			name: 'Magnetic flux density',
			unit: 'T',
		},
		'047': {
			desc: 'DPT_Value_Magnetic_Moment',
			name: 'Magnetic moment',
			unit: 'A·m²',
		},
		'048': {
			desc: 'DPT_Value_Magnetic_Polarization',
			name: 'Magnetic polarization',
			unit: 'T',
		},
		'049': {
			desc: 'DPT_Value_Magnetization',
			name: 'Magnetization',
			unit: 'A/m',
		},
		'050': {
			desc: 'DPT_Value_MagnetomotiveForce',
			name: 'Magnetomotive force',
			unit: 'A',
		},
		'051': {
			desc: 'DPT_Value_Mass',
			name: 'Mass',
			unit: 'kg',
		},
		'052': {
			desc: 'DPT_Value_MassFlux',
			name: 'Mass flux',
			unit: 'kg/s',
		},
		'053': {
			desc: 'DPT_Value_Momentum',
			name: 'Momentum',
			unit: 'N·s',
		},
		'054': {
			desc: 'DPT_Value_Phase_AngleRad',
			name: 'Phase angle, radian',
			unit: 'rad',
		},
		'055': {
			desc: 'DPT_Value_Phase_AngleDeg',
			name: 'Phase angle, degree',
			unit: '°',
		},
		'056': {
			desc: 'DPT_Value_Power',
			name: 'Power',
			unit: 'W',
		},
		'057': {
			desc: 'DPT_Value_Power_Factor',
			name: 'Power factor',
			unit: 'cos Φ',
		},
		'058': {
			desc: 'DPT_Value_Pressure',
			name: 'Pressure',
			unit: 'Pa',
		},
		'059': {
			desc: 'DPT_Value_Reactance',
			name: 'Reactance',
			unit: 'Ω',
		},
		'060': {
			desc: 'DPT_Value_Resistance',
			name: 'Resistance',
			unit: 'Ω',
		},
		'061': {
			desc: 'DPT_Value_Resistivity',
			name: 'Resistivity',
			unit: 'Ω·m',
		},
		'062': {
			desc: 'DPT_Value_SelfInductance',
			name: 'Self inductance',
			unit: 'H',
		},
		'063': {
			desc: 'DPT_Value_SolidAngle',
			name: 'Solid angle',
			unit: 'sr',
		},
		'064': {
			desc: 'DPT_Value_Sound_Intensity',
			name: 'Sound intensity',
			unit: 'W/m²',
		},
		'065': {
			desc: 'DPT_Value_Speed',
			name: 'Speed',
			unit: 'm/s',
		},
		'066': {
			desc: 'DPT_Value_Stress',
			name: 'Stress',
			unit: 'Pa',
		},
		'067': {
			desc: 'DPT_Value_Surface_Tension',
			name: 'Surface tension',
			unit: 'N/m',
		},
		'068': {
			desc: 'DPT_Value_Common_Temperature',
			name: 'Temperature',
			unit: '°C',
		},
		'069': {
			desc: 'DPT_Value_Absolute_Temperature',
			name: 'Temperature (absolute)',
			unit: 'K',
		},
		'070': {
			desc: 'DPT_Value_TemperatureDifference',
			name: 'Temperature difference',
			unit: 'K',
		},
		'071': {
			desc: 'DPT_Value_Thermal_Capacity',
			name: 'Thermal capacity',
			unit: 'J/K',
		},
		'072': {
			desc: 'DPT_Value_Thermal_Conductivity',
			name: 'Thermal conductivity',
			unit: 'W/(m·K)',
		},
		'073': {
			desc: 'DPT_Value_ThermoelectricPower',
			name: 'Thermoelectric power',
			unit: 'V/K',
		},
		'074': {
			desc: 'DPT_Value_Time',
			name: 'Time',
			unit: 's',
		},
		'075': {
			desc: 'DPT_Value_Torque',
			name: 'Torque',
			unit: 'N·m',
		},
		'076': {
			desc: 'DPT_Value_Volume',
			name: 'Volume',
			unit: 'm³',
		},
		'077': {
			desc: 'DPT_Value_Volume_Flux',
			name: 'Volume flux',
			unit: 'm³/s',
		},
		'078': {
			desc: 'DPT_Value_Weight',
			name: 'Weight',
			unit: 'N',
		},
		'079': {
			desc: 'DPT_Value_Work',
			name: 'Work',
			unit: 'J',
		},
		'1200': {
			desc: 'DPT_Value_Volume_m3_h',
			name: 'Flow rate',
			unit: 'm³/h',
		},
	},
}

export default config
