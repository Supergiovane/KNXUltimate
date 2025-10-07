/**
 * Defines the Buffer Length Error used within KNXUltimate error handling.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

export default class BufferLengthError extends Error {
	public constructor() {
		super('Buffer Length')

		// We need to set the prototype explicitly
		Object.setPrototypeOf(this, BufferLengthError.prototype)
		Object.getPrototypeOf(this).name = 'BufferLengthError'
	}
}
