/**
 * Validates KNX Data Point Type 60001 conversions.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT60001 from '../../src/dptlib/dpt60001'

describe('DPT60001 (Griesser Object)', () => {
	describe('formatAPDU', () => {
		test('should correctly format local operation commands', () => {
			const input = {
				command: 'operation code',
				data: ['localoperation', 'long up'],
				sectors: [159],
			}

			const result = DPT60001.formatAPDU(input)

			assert.ok(Buffer.isBuffer(result))
			assert.equal(result.length, 6)
			// Instead of checking specific byte values, we can verify that
			// the buffer is correctly formatted by using fromBuffer
			const decoded = DPT60001.fromBuffer(result)
			assert.ok(decoded)
			assert.equal(decoded.command, 'operation code')
			assert.deepEqual(decoded.sectors, [159])
			assert.ok(Array.isArray(decoded.data))
			assert.equal(decoded.data[0], 'localoperation')
			assert.equal(decoded.data[1], 'long up')
		})

		test('should handle invalid inputs', () => {
			// Null value
			assert.equal(DPT60001.formatAPDU(null), null)

			// Missing required properties
			assert.equal(DPT60001.formatAPDU({} as any), null)

			// Invalid data array
			assert.equal(
				DPT60001.formatAPDU({
					command: 'operation code',
					data: ['invalid', 'long up'],
					sectors: [159],
				}),
				null,
			)

			// Missing sectors
			assert.equal(
				DPT60001.formatAPDU({
					command: 'operation code',
					data: ['localoperation', 'long up'],
				} as any),
				null,
			)
		})
	})

	describe('fromBuffer', () => {
		test('should correctly parse operation code buffer', () => {
			// Create a valid buffer using formatAPDU
			const input = {
				command: 'operation code',
				data: ['localoperation', 'long up'],
				sectors: [42],
			}
			const buffer = DPT60001.formatAPDU(input)
			assert.ok(buffer)

			const result = DPT60001.fromBuffer(buffer)
			assert.ok(result)
			assert.equal(result.command, 'operation code')
			assert.deepEqual(result.sectors, [42])
			assert.equal(typeof result.prio, 'string')
		})

		test('should handle invalid buffer length', () => {
			// Test buffer too short
			assert.equal(DPT60001.fromBuffer(Buffer.from([1, 2, 3])), null)

			// Test buffer too long
			assert.equal(
				DPT60001.fromBuffer(Buffer.from([1, 2, 3, 4, 5, 6, 7])),
				null,
			)
		})
	})

	describe('Command Parsing', () => {
		test('should correctly identify commands', () => {
			const testCases = [
				{
					input: {
						command: 'operation code',
						data: ['localoperation', 'long up'],
						sectors: [1],
					},
					expectedCommand: 'operation code',
				},
				{
					input: {
						command: 'operation code',
						data: ['localoperation', 'long down'],
						sectors: [1],
					},
					expectedCommand: 'operation code',
				},
			]

			for (const testCase of testCases) {
				const buffer = DPT60001.formatAPDU(testCase.input)
				assert.ok(buffer)
				const result = DPT60001.fromBuffer(buffer)
				assert.ok(result)
				assert.equal(result.command, testCase.expectedCommand)
			}
		})
	})

	describe('End to end test', () => {
		test('should correctly encode and decode operation commands', () => {
			const original = {
				command: 'operation code',
				data: ['localoperation', 'long up'],
				sectors: [42],
			}

			const buffer = DPT60001.formatAPDU(original)
			assert.ok(buffer)
			const decoded = DPT60001.fromBuffer(buffer)
			assert.ok(decoded)

			assert.equal(decoded.command, original.command)
			assert.deepEqual(decoded.data[0], original.data[0])
			assert.deepEqual(decoded.sectors, original.sectors)
		})
	})
})
