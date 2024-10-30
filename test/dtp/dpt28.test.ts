import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT28 from '../../src/dptlib/dpt28'

describe('DPT28 (ASCII string UTF-8)', () => {
	describe('formatAPDU', () => {
		test('should correctly format valid UTF-8 strings', () => {
			const dpt = { ...DPT28, subtypeid: '001' }

			// Test basic ASCII string
			let result = dpt.formatAPDU('Hello')
			assert.ok(Buffer.isBuffer(result))
			assert.equal(result.length, 14)
			// The string is padded with null bytes
			assert.match(result.toString('utf-8'), /^Hello\0*$/)

			// Test empty string
			result = dpt.formatAPDU('')
			assert.ok(Buffer.isBuffer(result))
			assert.equal(result.length, 14)
			assert.match(result.toString('utf-8'), /^\0*$/)

			// Test UTF-8 characters
			result = dpt.formatAPDU('Hëllö UTF8')
			assert.ok(Buffer.isBuffer(result))
			assert.equal(result.length, 14)
			assert.match(result.toString('utf-8'), /^Hëllö UTF8\0*$/)
		})

		test('should truncate strings longer than 14 bytes', () => {
			const dpt = { ...DPT28, subtypeid: '001' }
			const result = dpt.formatAPDU(
				'This is a very long string that should be truncated',
			)
			assert.ok(Buffer.isBuffer(result))
			assert.equal(result.length, 14)
			assert.match(result.toString('utf-8'), /^This is a ver/)
		})

		test('should handle non-string inputs', () => {
			const dpt = { ...DPT28, subtypeid: '001' }

			// Test number
			let result = dpt.formatAPDU(123 as any)
			assert.ok(Buffer.isBuffer(result))
			assert.match(result.toString('utf-8'), /^123\0*$/)

			// Test null/undefined
			result = dpt.formatAPDU(null as any)
			if (typeof result === 'string') {
				assert.equal(result, 'DPT Err')
			} else {
				assert.ok(Buffer.isBuffer(result))
				assert.match(result.toString('utf-8'), /^DPT Err\0*$/)
			}

			result = dpt.formatAPDU(undefined as any)
			if (typeof result === 'string') {
				assert.equal(result, 'DPT Err')
			} else {
				assert.ok(Buffer.isBuffer(result))
				assert.match(result.toString('utf-8'), /^DPT Err\0*$/)
			}
		})

		test('should handle invalid subtypeid', () => {
			const dpt = { ...DPT28, subtypeid: '002' }
			const result = dpt.formatAPDU('test')
			assert.ok(Buffer.isBuffer(result))
			assert.equal(result.length, 14)
			// Buffer is filled with null bytes when subtypeid is not 001
			assert.match(result.toString('utf-8'), /^\0*$/)
		})
	})

	describe('fromBuffer', () => {
		test('should correctly parse valid buffers', () => {
			const dpt = { ...DPT28, subtypeid: '001' }

			// Test basic ASCII string
			let buffer = Buffer.alloc(14)
			buffer.write('Hello', 'utf-8')
			// The string includes null bytes padding
			assert.match(dpt.fromBuffer(buffer), /^Hello\0*$/)

			// Test UTF-8 characters
			buffer = Buffer.alloc(14)
			buffer.write('Hëllö UTF8', 'utf-8')
			assert.match(dpt.fromBuffer(buffer), /^Hëllö UTF8\0*$/)

			// Test empty buffer
			buffer = Buffer.alloc(14)
			assert.match(dpt.fromBuffer(buffer), /^\0*$/)
		})

		test('should handle variable length buffers', () => {
			const dpt = { ...DPT28, subtypeid: '001' }

			// Test shorter buffer
			let buffer = Buffer.alloc(10)
			buffer.write('Short', 'utf-8')
			assert.match(dpt.fromBuffer(buffer), /^Short\0*$/)

			// Test longer buffer
			buffer = Buffer.alloc(20)
			buffer.write('Long buffer test', 'utf-8')
			assert.match(dpt.fromBuffer(buffer), /^Long buffer test/)
		})

		test('should handle invalid subtypeid', () => {
			const dpt = { ...DPT28, subtypeid: '002' }
			const buffer = Buffer.alloc(14)
			buffer.write('test', 'utf-8')
			assert.equal(dpt.fromBuffer(buffer), undefined)
		})
	})
})
