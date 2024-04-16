
export default class InvalidValueError extends Error {
    public constructor() {
		super('invalid value')

		// We need to set the prototype explicitly
		Object.setPrototypeOf(this, InvalidValueError.prototype)
		Object.getPrototypeOf(this).name = 'InvalidValueError'
	}
}
