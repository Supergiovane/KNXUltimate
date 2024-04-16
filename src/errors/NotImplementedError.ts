
export default class NotImplementedError extends Error {
    public constructor() {
		super('Not implemented')

		// We need to set the prototype explicitly
		Object.setPrototypeOf(this, NotImplementedError.prototype)
		Object.getPrototypeOf(this).name = 'NotImplementedError'
	}
}

