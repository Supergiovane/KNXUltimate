// eslint-disable-next-line import/prefer-default-export
import { setTimeout as pleaseWait } from 'timers/promises'

export function hasProp(obj: any, prop: string): boolean {
	return Object.prototype.hasOwnProperty.call(obj, prop)
}

export function hex2bin(hex: string) {
	return parseInt(hex, 16).toString(2).padStart(8, '0')
}

export function hexToDec(hex: string) {
	let result = 0
	let digitValue: number
	hex = hex.toLowerCase()
	for (let i = 0; i < hex.length; i++) {
		digitValue = '0123456789abcdefgh'.indexOf(hex[i])
		result = result * 16 + digitValue
	}
	return result
}

/**
 * Convert `mantissa` and `exponent` into a float32 number
 *kudos to http://croquetweak.blogspot.gr/2014/08/deconstructing-floats-frexp-and-ldexp.html
 */
export function ldexp(mantissa: number, exponent: number) {
	// eslint-disable-next-line no-nested-ternary
	return exponent > 1023 // avoid multiplying by infinity
		? mantissa * 2 ** 1023 * 2 ** (exponent - 1023)
		: exponent < -1074 // avoid multiplying by zero
			? mantissa * 2 ** -1074 * 2 ** (exponent + 1074)
			: mantissa * 2 ** exponent
}

/**
 * Decompose a float32 number into [mantissa, exponent]
 */
export function frexp(value: number) {
	if (value === 0) return [value, 0]
	const data = new DataView(new ArrayBuffer(8))
	data.setFloat64(0, value)
	let bits = (data.getUint32(0) >>> 20) & 0x7ff
	if (bits === 0) {
		data.setFloat64(0, value * 2 ** 64)
		bits = ((data.getUint32(0) >>> 20) & 0x7ff) - 64
	}
	const exponent = bits - 1022
	const mantissa = ldexp(value, -exponent)
	return [mantissa, exponent]
}

/**
 * Convert a float32 number into a 2-byte array
 */
export function getHex(_value: number) {
	try {
		const arr = frexp(_value)
		const mantissa = arr[0]
		const exponent = arr[1]
		// find the minimum exponent that will upsize the normalized mantissa (0,5 to 1 range)
		// in order to fit in 11 bits ([-2048, 2047])
		let max_mantissa = 0
		let e: number
		for (e = exponent; e >= -15; e--) {
			max_mantissa = ldexp(100 * mantissa, e)
			if (max_mantissa > -2048 && max_mantissa < 2047) break
		}
		const sign = mantissa < 0 ? 1 : 0
		const mant = mantissa < 0 ? ~(max_mantissa ^ 2047) : max_mantissa
		const exp = exponent - e
		return [(sign << 7) + (exp << 3) + (mant >> 8), mant % 256]
	} catch (error) {
		return null
	}
}
/**
 * Convert a 2-byte array into a float32 number
 */
export function getFloat(_value0: number, _value1: number) {
	const sign = _value0 >> 7
	const exponent = (_value0 & 0b01111000) >> 3
	let mantissa = 256 * (_value0 & 0b00000111) + _value1
	mantissa = sign === 1 ? ~(mantissa ^ 2047) : mantissa
	return parseFloat(ldexp(0.01 * mantissa, exponent).toPrecision(15))
}

/**
 * Round a number to a given number of decimals
 */
export function round(value: number, decimals: number) {
	return Number(`${Math.round(Number(`${value}e${decimals}`))}e-${decimals}`)
}

/**
 * Get current timestamp. Used for debug level logging, at telegram's level.
 */
export function getTimestamp() {
	const now = new Date()
	const seconds = now.getSeconds().toString().padStart(2, '0') // Secondi con due cifre
	const milliseconds = now.getMilliseconds().toString().padStart(3, '0') // Millisecondi con tre cifre
	return `${seconds}.${milliseconds}`
}

export async function wait(ms: number) {
	return pleaseWait(ms)
}
