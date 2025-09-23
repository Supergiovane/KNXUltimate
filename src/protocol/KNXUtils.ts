/**
 * Shared protocol helpers for KNX packet handling.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

export function splitIP(ip: string, name: string = 'ip'): RegExpMatchArray {
	if (ip == null) {
		throw new Error(`${name} undefined`)
	}
	const m = ip.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)/)
	if (m === null) {
		throw new Error(`Invalid ${name} format - ${ip}`)
	}
	return m
}

export function validateKNXAddress(
	address: string | number,
	isGroup: boolean = false,
) {
	if (typeof address === 'string') {
		const digits = address.split(/[./]/)
		if (digits.length < 2 || digits.length > 3) {
			throw new Error(
				`Invalid address format: ${address} Only 3 level addresses are allowed`,
			)
		}
		if (
			(digits.length === 3 && address === '0/0/0') ||
			(digits.length === 1 && address === '0/0')
		) {
			throw new Error(`Invalid address: ${address}`)
		}

		let count = 0
		let newAddress = 0
		for (let i = digits.length - 1; i >= 0; i--, count++) {
			const digit = Number(digits[i])
			if (isGroup && digits.length === 3) {
				// Validating Group Address
				if (
					isNaN(digit) ||
					(count === 2 && digit > 31) ||
					(count === 1 && digit > 7) ||
					(count === 0 && digit > 255)
				) {
					// 22/12/2021 Supergiovane disabled digits validation
					throw new Error(
						`Invalid 3 levels GA digit ${digit} inside address: ${address}`,
					)
				}
			} else if (isGroup && digits.length === 2) {
				// Validating Group Address
				if (
					isNaN(digit) ||
					(count === 1 && digit > 31) ||
					(count === 0 && digit > 2047)
				) {
					// 22/12/2021 Supergiovane disabled digits validation
					throw new Error(
						`Invalid 2 levels GA digit ${digit} inside address: ${address}`,
					)
				}
			} else {
				// Validating KNX Device Address
				// eslint-disable-next-line no-lonely-if
				if (
					isNaN(digit) ||
					(count > 1 && digit > 15) ||
					(count === 0 && digit > 255)
				) {
					// 22/12/2021 Supergiovane disabled digits validation
					throw new Error(
						`Invalid Individual Address digit ${digit} inside address: ${address}`,
					)
				}
			}
			if (count === 0) {
				newAddress = digit
			} else if (count === 1) {
				newAddress += digit << 8
			} else if (isGroup) {
				newAddress += digit << 11
			} else {
				newAddress += digit << 12
			}
		}
		return newAddress
	}
	const _address = Number(address)
	if (isNaN(_address) || _address < 0 || _address > 0xffff) {
		throw new Error(`Invalid address ${address}`)
	}
	return _address
}
