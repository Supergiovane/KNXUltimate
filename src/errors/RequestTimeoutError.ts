export default class RequestTimeoutError extends Error {
    public constructor() {
		super('Request timeout')

		// We need to set the prototype explicitly
		Object.setPrototypeOf(this, RequestTimeoutError.prototype)
		Object.getPrototypeOf(this).name = 'RequestTimeoutError'
	}
}

