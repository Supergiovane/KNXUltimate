import { test } from 'node:test'
import assert from 'node:assert/strict'
import InvalidValueError from '../../src/errors/InvalidValueError'

test('InvalidValueError', async (t) => {
	await t.test('should create an error with the correct message', () => {
		const error = new InvalidValueError()
		assert.strictEqual(error.message, 'invalid value')
	})

	await t.test('should be an instance of Error', () => {
		const error = new InvalidValueError()
		assert.ok(error instanceof Error)
	})

	await t.test('should be an instance of InvalidValueError', () => {
		const error = new InvalidValueError()
		assert.ok(error instanceof InvalidValueError)
	})

	await t.test('should have correct name property', () => {
		const error = new InvalidValueError()
		assert.strictEqual(error.constructor.name, 'InvalidValueError')
		assert.strictEqual(
			Object.getPrototypeOf(error).name,
			'InvalidValueError',
		)
	})

	await t.test('should maintain prototype chain', () => {
		const error = new InvalidValueError()
		assert.strictEqual(Object.getPrototypeOf(error.constructor), Error)
	})

	await t.test('should be catchable as InvalidValueError', () => {
		assert.doesNotThrow(() => {
			try {
				throw new InvalidValueError()
			} catch (error) {
				assert.ok(error instanceof InvalidValueError)
				assert.ok(error instanceof Error)
			}
		})
	})
})
