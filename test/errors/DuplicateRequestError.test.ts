import { test } from 'node:test'
import assert from 'node:assert'
import DuplicateRequestError from '../../src/errors/DuplicateRequestError'

test('DuplicateRequestError', async (t) => {
	await t.test('should create an instance of Error', () => {
		const error = new DuplicateRequestError()
		assert.ok(error instanceof Error)
	})

	await t.test('should create an instance of DuplicateRequestError', () => {
		const error = new DuplicateRequestError()
		assert.ok(error instanceof DuplicateRequestError)
	})

	await t.test('should set the correct error message', () => {
		const error = new DuplicateRequestError()
		assert.strictEqual(error.message, 'Duplicate request')
	})

	await t.test('should set the correct error name', () => {
		const error = new DuplicateRequestError()
		assert.strictEqual(error.name, 'DuplicateRequestError')
	})

	await t.test('should maintain proper inheritance chain', () => {
		const error = new DuplicateRequestError()
		assert.strictEqual(
			Object.getPrototypeOf(Object.getPrototypeOf(error)),
			Error.prototype,
		)
	})

	await t.test('should be catchable as a DuplicateRequestError', () => {
		try {
			throw new DuplicateRequestError()
		} catch (error) {
			assert.ok(error instanceof DuplicateRequestError)
		}
	})
})
