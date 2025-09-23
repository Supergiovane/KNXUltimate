/**
 * Validates KNX Data Point Type 21 conversions.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT21 from '../../src/dptlib/dpt21'

describe('DPT21 (General Status)', () => {
	describe('formatAPDU', () => {
		test('should correctly format valid status objects', () => {
			// All flags false
			assert.deepEqual(
				DPT21.formatAPDU({
					outOfService: false,
					fault: false,
					overridden: false,
					inAlarm: false,
					alarmUnAck: false,
				}),
				Buffer.from([0b00000000]),
			)

			// All flags true
			assert.deepEqual(
				DPT21.formatAPDU({
					outOfService: true,
					fault: true,
					overridden: true,
					inAlarm: true,
					alarmUnAck: true,
				}),
				Buffer.from([0b00011111]),
			)

			// Mixed flags
			assert.deepEqual(
				DPT21.formatAPDU({
					outOfService: true,
					fault: false,
					overridden: true,
					inAlarm: false,
					alarmUnAck: true,
				}),
				Buffer.from([0b00010101]),
			)
		})
	})

	describe('fromBuffer', () => {
		test('should correctly parse valid buffers', () => {
			// All bits 0
			assert.deepEqual(DPT21.fromBuffer(Buffer.from([0b00000000])), {
				outOfService: false,
				fault: false,
				overridden: false,
				inAlarm: false,
				alarmUnAck: false,
			})

			// All relevant bits 1
			assert.deepEqual(DPT21.fromBuffer(Buffer.from([0b00011111])), {
				outOfService: true,
				fault: true,
				overridden: true,
				inAlarm: true,
				alarmUnAck: true,
			})

			// Mixed bits
			assert.deepEqual(DPT21.fromBuffer(Buffer.from([0b00010101])), {
				outOfService: true,
				fault: false,
				overridden: true,
				inAlarm: false,
				alarmUnAck: true,
			})

			// Reserved bits should be ignored (bits 5-7)
			assert.deepEqual(DPT21.fromBuffer(Buffer.from([0b11110101])), {
				outOfService: true,
				fault: false,
				overridden: true,
				inAlarm: false,
				alarmUnAck: true,
			})
		})

		test('should handle invalid buffer lengths', () => {
			// Empty buffer
			assert.strictEqual(DPT21.fromBuffer(Buffer.from([])), null)

			// Buffer too long
			assert.strictEqual(DPT21.fromBuffer(Buffer.from([0, 1])), null)
		})
	})
})
