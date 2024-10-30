import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT16 from '../../src/dptlib/dpt16'

describe('DPT16 (14-character string)', () => {
	describe('formatAPDU', () => {
		test('should correctly format ASCII strings (subtype 000)', () => {
			const dpt = { ...DPT16, subtypeid: '000' }

			// Test basic ASCII string
			const result1 = dpt.formatAPDU('Hello')
			assert.ok(Buffer.isBuffer(result1))
			assert.equal(Buffer.byteLength(result1), 14)
			const expected1 = Buffer.alloc(14)
			expected1.write('Hello', 'ascii')
			assert.deepEqual(result1, expected1)

			// Test full length ASCII string - gets truncated at 14 chars
			const result2 = dpt.formatAPDU('Hello World 123')
			assert.ok(Buffer.isBuffer(result2))
			assert.equal(Buffer.byteLength(result2), 14)
			const expected2 = Buffer.alloc(14)
			expected2.write('Hello World 123', 'ascii')
			assert.deepEqual(result2, expected2)

			// Test empty string
			const result3 = dpt.formatAPDU('')
			assert.ok(Buffer.isBuffer(result3))
			assert.equal(Buffer.byteLength(result3), 14)
			assert.deepEqual(result3, Buffer.alloc(14))
		})

		test('should correctly format ISO-8859-1 strings (subtype 001)', () => {
			const dpt = { ...DPT16, subtypeid: '001' }

			// Test string with special characters
			const result1 = dpt.formatAPDU('Café')
			assert.ok(Buffer.isBuffer(result1))
			assert.equal(Buffer.byteLength(result1), 14)
			const expected1 = Buffer.alloc(14)
			expected1.write('Café', 'latin1')
			assert.deepEqual(result1, expected1)

			// Test full length string with special characters
			const result2 = dpt.formatAPDU('Crème Brûlée!!')
			assert.ok(Buffer.isBuffer(result2))
			assert.equal(Buffer.byteLength(result2), 14)
			const expected2 = Buffer.alloc(14)
			expected2.write('Crème Brûlée!!', 'latin1')
			assert.deepEqual(result2, expected2)
		})

		test('should handle non-string inputs', () => {
			const dpt = { ...DPT16, subtypeid: '000' }

			// Test number
			const result1 = dpt.formatAPDU(123 as any)
			assert.ok(Buffer.isBuffer(result1))
			assert.equal(Buffer.byteLength(result1), 14)
			const expected1 = Buffer.alloc(14)
			expected1.write('123', 'ascii')
			assert.deepEqual(result1, expected1)

			// Test null and undefined
			const result2 = dpt.formatAPDU(null as any)
			assert.ok(Buffer.isBuffer(result2))
			const expected2 = Buffer.alloc(14)
			expected2.write('DPT Err', 'ascii')
			assert.deepEqual(result2, expected2)

			const result3 = dpt.formatAPDU(undefined as any)
			assert.ok(Buffer.isBuffer(result3))
			const expected3 = Buffer.alloc(14)
			expected3.write('DPT Err', 'ascii')
			assert.deepEqual(result3, expected3)
		})

		test('should truncate strings longer than 14 characters', () => {
			const dpt = { ...DPT16, subtypeid: '000' }

			const result = dpt.formatAPDU('This is a very long string')
			assert.ok(Buffer.isBuffer(result))
			assert.equal(Buffer.byteLength(result), 14)
			const expected = Buffer.alloc(14)
			expected.write('This is a very', 'ascii')
			assert.deepEqual(result, expected)
		})
	})

	describe('fromBuffer', () => {
		test('should correctly parse ASCII buffers (subtype 000)', () => {
			const dpt = { ...DPT16, subtypeid: '000' }

			// Test basic ASCII string
			const buf1 = Buffer.alloc(14)
			buf1.write('Hello', 'ascii')
			assert.equal(dpt.fromBuffer(buf1)?.replace(/\0+$/, ''), 'Hello')

			// Test full buffer
			const buf2 = Buffer.alloc(14)
			buf2.write('Hello World 12', 'ascii')
			assert.equal(
				dpt.fromBuffer(buf2)?.replace(/\0+$/, ''),
				'Hello World 12',
			)
		})

		test('should correctly parse ISO-8859-1 buffers (subtype 001)', () => {
			const dpt = { ...DPT16, subtypeid: '001' }

			// Test string with special characters
			const buf1 = Buffer.alloc(14)
			buf1.write('Café', 'latin1')
			assert.equal(dpt.fromBuffer(buf1)?.replace(/\0+$/, ''), 'Café')

			// Test full buffer with special characters
			const buf2 = Buffer.alloc(14)
			buf2.write('Crème Brûlée!!', 'latin1')
			assert.equal(
				dpt.fromBuffer(buf2)?.replace(/\0+$/, ''),
				'Crème Brûlée!!',
			)
		})

		test('should handle invalid buffer lengths', () => {
			const dpt = { ...DPT16, subtypeid: '000' }

			// Test short buffer
			const shortBuf = Buffer.alloc(10)
			assert.equal(dpt.fromBuffer(shortBuf), null)

			// Test long buffer
			const longBuf = Buffer.alloc(20)
			assert.equal(dpt.fromBuffer(longBuf), null)

			// Test empty buffer
			const emptyBuf = Buffer.alloc(0)
			assert.equal(dpt.fromBuffer(emptyBuf), null)
		})
	})
})
