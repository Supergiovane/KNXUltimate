/**
 * Unit tests for KNXUltimate custom error classes.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
	BufferLengthError,
	DateFormatError,
	DuplicateRequestError,
	InvalidValueError,
	NotImplementedError,
	RequestTimeoutError,
} from '../../src/errors'

describe('Custom error classes', () => {
	describe('BufferLengthError', () => {
		test('is an instance of Error', () => {
			assert.ok(new BufferLengthError() instanceof Error)
		})

		test('is an instance of BufferLengthError', () => {
			assert.ok(new BufferLengthError() instanceof BufferLengthError)
		})

		test('has correct name', () => {
			assert.equal(new BufferLengthError().name, 'BufferLengthError')
		})

		test('has correct message', () => {
			assert.equal(new BufferLengthError().message, 'Buffer Length')
		})
	})

	describe('DateFormatError', () => {
		test('is an instance of Error', () => {
			assert.ok(new DateFormatError() instanceof Error)
		})

		test('is an instance of DateFormatError', () => {
			assert.ok(new DateFormatError() instanceof DateFormatError)
		})

		test('has correct name', () => {
			assert.equal(new DateFormatError().name, 'DateFormatError')
		})

		test('has correct message', () => {
			assert.equal(new DateFormatError().message, 'Date format')
		})
	})

	describe('DuplicateRequestError', () => {
		test('is an instance of Error', () => {
			assert.ok(new DuplicateRequestError() instanceof Error)
		})

		test('is an instance of DuplicateRequestError', () => {
			assert.ok(
				new DuplicateRequestError() instanceof DuplicateRequestError,
			)
		})

		test('has correct name', () => {
			assert.equal(
				new DuplicateRequestError().name,
				'DuplicateRequestError',
			)
		})

		test('has correct message', () => {
			assert.equal(
				new DuplicateRequestError().message,
				'Duplicate request',
			)
		})
	})

	describe('InvalidValueError', () => {
		test('is an instance of Error', () => {
			assert.ok(new InvalidValueError() instanceof Error)
		})

		test('is an instance of InvalidValueError', () => {
			assert.ok(new InvalidValueError() instanceof InvalidValueError)
		})

		test('has correct name', () => {
			assert.equal(new InvalidValueError().name, 'InvalidValueError')
		})

		test('has correct message', () => {
			assert.equal(new InvalidValueError().message, 'invalid value')
		})
	})

	describe('NotImplementedError', () => {
		test('is an instance of Error', () => {
			assert.ok(new NotImplementedError() instanceof Error)
		})

		test('is an instance of NotImplementedError', () => {
			assert.ok(new NotImplementedError() instanceof NotImplementedError)
		})

		test('has correct name', () => {
			assert.equal(new NotImplementedError().name, 'NotImplementedError')
		})

		test('has correct message', () => {
			assert.equal(new NotImplementedError().message, 'Not implemented')
		})
	})

	describe('RequestTimeoutError', () => {
		test('is an instance of Error', () => {
			assert.ok(new RequestTimeoutError('seq=3') instanceof Error)
		})

		test('is an instance of RequestTimeoutError', () => {
			assert.ok(
				new RequestTimeoutError('seq=3') instanceof RequestTimeoutError,
			)
		})

		test('has correct name', () => {
			assert.equal(
				new RequestTimeoutError('seq=3').name,
				'RequestTimeoutError',
			)
		})

		test('includes details in message', () => {
			assert.equal(
				new RequestTimeoutError('seq=3').message,
				'Request timeout: seq=3',
			)
		})

		test('embeds different details correctly', () => {
			assert.equal(
				new RequestTimeoutError('channel=2 seq=7').message,
				'Request timeout: channel=2 seq=7',
			)
		})
	})

	describe('can be caught as Error', () => {
		test('all error classes are catchable as Error', () => {
			const errors = [
				new BufferLengthError(),
				new DateFormatError(),
				new DuplicateRequestError(),
				new InvalidValueError(),
				new NotImplementedError(),
				new RequestTimeoutError('test'),
			]
			for (const err of errors) {
				try {
					throw err
				} catch (e) {
					assert.ok(
						e instanceof Error,
						`${err.name} should be catchable as Error`,
					)
				}
			}
		})
	})
})
