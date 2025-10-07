/**
 * Defines the Not Implemented Error used within KNXUltimate error handling.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

export default class NotImplementedError extends Error {
	public constructor() {
		super('Not implemented')

		// We need to set the prototype explicitly
		Object.setPrototypeOf(this, NotImplementedError.prototype)
		Object.getPrototypeOf(this).name = 'NotImplementedError'
	}
}
