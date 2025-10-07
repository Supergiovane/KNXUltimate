/**
 * Defines the Request Timeout Error used within KNXUltimate error handling.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

export default class RequestTimeoutError extends Error {
	public constructor(details: string) {
		super(`Request timeout: ${details}`)

		// We need to set the prototype explicitly
		Object.setPrototypeOf(this, RequestTimeoutError.prototype)
		Object.getPrototypeOf(this).name = 'RequestTimeoutError'
	}
}
