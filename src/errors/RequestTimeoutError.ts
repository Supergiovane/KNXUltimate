export default class RequestTimeoutError extends Error {
	public constructor(details: string) {
		super(`Request timeout: ${details}`)

		// We need to set the prototype explicitly
		Object.setPrototypeOf(this, RequestTimeoutError.prototype)
		Object.getPrototypeOf(this).name = 'RequestTimeoutError'
	}
}
