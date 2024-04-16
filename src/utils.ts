// eslint-disable-next-line import/prefer-default-export
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

// kudos to http://croquetweak.blogspot.gr/2014/08/deconstructing-floats-frexp-and-ldexp.html
export function ldexp(mantissa: number, exponent: number) {
	// eslint-disable-next-line no-nested-ternary
	return exponent > 1023 // avoid multiplying by infinity
		? mantissa * 2 ** 1023 * 2 ** (exponent - 1023)
		: exponent < -1074 // avoid multiplying by zero
			? mantissa * 2 ** -1074 * 2 ** (exponent + 1074)
			: mantissa * 2 ** exponent
}

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
