
export default class DuplicateRequestError extends Error {

    public constructor() {
		super('Duplicate request')

		// We need to set the prototype explicitly
		Object.setPrototypeOf(this, DuplicateRequestError.prototype)
		Object.getPrototypeOf(this).name = 'DuplicateRequestError'
	}
}

