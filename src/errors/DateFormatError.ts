/**
 * Defines the Date Format Error used within KNXUltimate error handling.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

export default class DateFormatError extends Error {
	public constructor() {
		super('Date format')

		// We need to set the prototype explicitly
		Object.setPrototypeOf(this, DateFormatError.prototype)
		Object.getPrototypeOf(this).name = 'DateFormatError'
	}
}
