export default class BufferLengthError extends Error {
	public constructor() {
		super('Buffer Length')

		// We need to set the prototype explicitly
		Object.setPrototypeOf(this, BufferLengthError.prototype)
		Object.getPrototypeOf(this).name = 'BufferLengthError'
	}
}
