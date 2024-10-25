import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import NotImplementedError from '../../src/errors/NotImplementedError'

describe('NotImplementedError', async (t) => {
	it('should be an instance of Error', () => {
		const error = new NotImplementedError()
		assert.ok(error instanceof Error)
	})

	it('should be an instance of NotImplementedError', () => {
		const error = new NotImplementedError()
		assert.ok(error instanceof NotImplementedError)
	})

	it('should have the correct error message', () => {
		const error = new NotImplementedError()
		assert.equal(error.message, 'Not implemented')
	})

	it('should have the correct name', () => {
		const error = new NotImplementedError()
		assert.equal(Object.getPrototypeOf(error).name, 'NotImplementedError')
	})

	it('should maintain proper prototype chain', () => {
		const error = new NotImplementedError()
		const prototype = Object.getPrototypeOf(error)
		assert.ok(prototype === NotImplementedError.prototype)
		assert.ok(Object.getPrototypeOf(prototype) === Error.prototype)
	})

	it('should work with instanceof after prototype manipulation', () => {
		const error = new NotImplementedError()
		assert.ok(error instanceof NotImplementedError)
		assert.ok(error instanceof Error)
	})

	it('should have stack trace', () => {
		const error = new NotImplementedError()
		assert.ok(error.stack)
		assert.ok(error.stack.includes('NotImplementedError: Not implemented'))
	})
})
