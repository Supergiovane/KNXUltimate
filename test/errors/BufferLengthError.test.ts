import { test } from 'node:test'
import assert from 'node:assert'
import BufferLengthError from '../../src/errors/BufferLengthError'

test('BufferLengthError class', async (t) => {
	await t.test('should create an instance with correct properties', () => {
		const error = new BufferLengthError()

		// Test inheritance
		assert.ok(error instanceof Error, 'should inherit from Error')
		assert.ok(
			error instanceof BufferLengthError,
			'should be instance of BufferLengthError',
		)

		// Test error message
		assert.strictEqual(
			error.message,
			'Buffer Length',
			'should have correct error message',
		)

		// Test name property
		assert.strictEqual(
			Object.getPrototypeOf(error).name,
			'BufferLengthError',
			'should have correct name',
		)

		// Test prototype chain
		assert.strictEqual(
			Object.getPrototypeOf(error).constructor,
			BufferLengthError,
			'should have correct prototype chain',
		)
	})

	await t.test('should preserve stack trace', () => {
		const error = new BufferLengthError()
		assert.ok(error.stack, 'should have a stack trace')
		assert.ok(
			error.stack.includes('BufferLengthError'),
			'stack trace should contain error name',
		)
	})

	await t.test('should be throwable and catchable', () => {
		assert.throws(
			() => {
				throw new BufferLengthError()
			},
			(error) => {
				return (
					error instanceof BufferLengthError &&
					error.message === 'Buffer Length'
				)
			},
			'should be able to throw and catch with correct properties',
		)
	})

	await t.test('should have correct custom properties after caught', () => {
		try {
			throw new BufferLengthError()
		} catch (error) {
			assert.ok(
				error instanceof BufferLengthError,
				'should maintain instanceof after caught',
			)
			assert.strictEqual(
				error.message,
				'Buffer Length',
				'should maintain message after caught',
			)
			assert.strictEqual(
				Object.getPrototypeOf(error).name,
				'BufferLengthError',
				'should maintain name after caught',
			)
		}
	})
})
