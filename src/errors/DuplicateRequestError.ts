/**
 * Defines the Duplicate Request Error used within KNXUltimate error handling.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

export default class DuplicateRequestError extends Error {
	public constructor() {
		super('Duplicate request')

		// We need to set the prototype explicitly
		Object.setPrototypeOf(this, DuplicateRequestError.prototype)
		Object.getPrototypeOf(this).name = 'DuplicateRequestError'
	}
}
