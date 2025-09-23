/**
 * Defines the Invalid Value Error used within KNXUltimate error handling.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

export default class InvalidValueError extends Error {
	public constructor() {
		super('invalid value')

		// We need to set the prototype explicitly
		Object.setPrototypeOf(this, InvalidValueError.prototype)
		Object.getPrototypeOf(this).name = 'InvalidValueError'
	}
}
