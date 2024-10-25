import { test } from 'node:test'
import assert from 'node:assert'
import DateFormatError from '../../src/errors/DateFormatError'

test('DateFormatError class', async (t) => {
	await t.test('should create an instance of DateFormatError', () => {
		const error = new DateFormatError()
		assert.ok(error instanceof DateFormatError)
		assert.ok(error instanceof Error)
	})

	await t.test('should have the correct error message', () => {
		const error = new DateFormatError()
		assert.strictEqual(error.message, 'Date format')
	})

	await t.test('should have the correct name property', () => {
		const error = new DateFormatError()
		assert.strictEqual(Object.getPrototypeOf(error).name, 'DateFormatError')
	})

	await t.test('should maintain proper inheritance chain', () => {
		const error = new DateFormatError()
		assert.strictEqual(
			Object.getPrototypeOf(error).constructor,
			DateFormatError,
		)
		assert.ok(Object.getPrototypeOf(error) instanceof Error)
	})

	await t.test('should be caught as DateFormatError in try-catch', () => {
		try {
			throw new DateFormatError()
		} catch (error) {
			assert.ok(error instanceof DateFormatError)
			assert.ok(error instanceof Error)
		}
	})
})
