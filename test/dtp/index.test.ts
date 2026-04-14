/**
 * Tests datapoint type export wiring.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
	dpts,
	resolve,
	populateAPDU,
	fromBuffer,
	APDU,
	DatapointConfig,
} from '../../src/dptlib'
import DPT1 from '../../src/dptlib/dpt1'
import DPT9 from '../../src/dptlib/dpt9'

describe('KNX DPT Handler', () => {
	describe('DPT Resolution', () => {
		it('should resolve DPT from subtype format', () => {
			const dpt = resolve('9.001')
			assert.equal(dpt.id, 'DPT9')
			assert.equal(dpt.subtypeid, '001')
		})

		it('should resolve DPT from full DPT format', () => {
			const dpt = resolve('DPT9.001')
			assert.equal(dpt.id, 'DPT9')
			assert.equal(dpt.subtypeid, '001')
		})

		it('should handle case-insensitive DPT format', () => {
			const dpt = resolve('dpt9.001')
			assert.equal(dpt.id, 'DPT9')
			assert.equal(dpt.subtypeid, '001')
		})

		it('should throw error for invalid DPT format', () => {
			assert.throws(() => resolve('invalid'), {
				message: 'Invalid DPT format: invalid',
			})
		})

		it('should throw error for unsupported DPT', () => {
			assert.throws(() => resolve('999999'), {
				message: 'Unsupported DPT: 999999',
			})
		})
	})

	describe('Buffer Conversion', () => {
		it('should convert buffer to boolean for DPT1', () => {
			const trueBuf = Buffer.from([1])
			const falseBuf = Buffer.from([0])

			const trueValue = fromBuffer(trueBuf, DPT1)
			const falseValue = fromBuffer(falseBuf, DPT1)

			assert.equal(
				typeof trueValue,
				'boolean',
				'should return a boolean value',
			)
			assert.equal(
				typeof falseValue,
				'boolean',
				'should return a boolean value',
			)

			assert.equal(
				trueValue,
				true,
				'buffer value 1 should convert to true',
			)
			assert.equal(
				falseValue,
				false,
				'buffer value 0 should convert to false',
			)
		})

		it('should convert buffer to float for DPT9', () => {
			// Example buffer for value 21.5
			const buf = Buffer.from([0x0c, 0x1a]) // Just an example value
			const value = fromBuffer(buf, DPT9)
			assert(typeof value === 'number')
		})

		it('should handle signed values correctly', () => {
			const dpt = {
				id: 'TEST',
				basetype: {
					bitlength: 8,
					signedness: 'signed',
					valuetype: 'number',
				},
			}

			const buf = Buffer.from([-5])
			assert.equal(fromBuffer(buf, dpt), -5)
		})

		it('should handle scalar range conversion', () => {
			const dpt: DatapointConfig = {
				id: 'TEST',
				basetype: {
					bitlength: 8,
					valuetype: 'number',
				},
				subtype: {
					name: 'test subtype',
					scalar_range: [0, 100],
				},
			}

			const buf = Buffer.from([255]) // Max value
			assert.equal(fromBuffer(buf, dpt), 100)
		})

		it('should return null for generic DPT length mismatches', () => {
			assert.equal(
				fromBuffer(Buffer.from([1, 2, 3]), resolve('5.001')),
				null,
			)
			assert.equal(fromBuffer(Buffer.from([0]), resolve('13.010')), null)
			assert.equal(fromBuffer(Buffer.from([]), resolve('17.001')), null)
		})

		it('should add DPT context when decoding throws', () => {
			const dpt: DatapointConfig = {
				id: 'TEST_THROW',
				basetype: {
					bitlength: 8,
					valuetype: 'number',
				},
				fromBuffer: () => {
					throw new Error('boom')
				},
			}

			assert.throws(() => fromBuffer(Buffer.from([0x12]), dpt), {
				message: 'TEST_THROW: decode failed for buffer [12]: boom',
			})
		})

		it('should pass telegram context to custom formatAPDU', () => {
			const dptKey = 'DPT777'
			let capturedContext: any = null
			dpts[dptKey] = {
				id: dptKey,
				basetype: {
					bitlength: 8,
					valuetype: 'basic',
				},
				subtypes: {
					'001': {
						name: 'test',
					},
				},
				formatAPDU: (_value, context) => {
					capturedContext = context
					return Buffer.from([0x01])
				},
			}

			const apdu = {} as APDU
			try {
				populateAPDU(1, apdu, '777.001', {
					groupAddress: '1/2/3',
					sourceAddress: '1.1.15',
				})
				assert.equal(capturedContext?.groupAddress, '1/2/3')
				assert.equal(capturedContext?.sourceAddress, '1.1.15')
				assert.equal(capturedContext?.dptid, '777.001')
				assert.equal(
					capturedContext?.logSuffix,
					' [ga=1/2/3 src=1.1.15 dpt=777.001]',
				)
			} finally {
				delete dpts[dptKey]
			}
		})
	})
})
