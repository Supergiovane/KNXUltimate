/**
 * Defines the error raised when the KNX interface reports a negative L_Data.con.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

export default class ConfirmationError extends Error {
	public constructor(details: string) {
		super(`Negative confirmation: ${details}`)

		// We need to set the prototype explicitly
		Object.setPrototypeOf(this, ConfirmationError.prototype)
		Object.getPrototypeOf(this).name = 'ConfirmationError'
	}
}
