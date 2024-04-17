export default class DateFormatError extends Error {
	public constructor() {
		super('Date format')

		// We need to set the prototype explicitly
		Object.setPrototypeOf(this, DateFormatError.prototype)
		Object.getPrototypeOf(this).name = 'DateFormatError'
	}
}
