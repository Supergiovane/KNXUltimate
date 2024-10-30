import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import DPT22 from '../../src/dptlib/dpt22'

describe('DPT22 (2-byte RHCC status)', () => {
	describe('formatAPDU', () => {
		test('should correctly format all flags set to false', () => {
			const value = {
				Fault: false,
				StatusEcoH: false,
				TempFlowLimit: false,
				TempReturnLimit: false,
				StatusMorningBoostH: false,
				StatusStartOptim: false,
				StatusStopOptim: false,
				HeatingDisabled: false,
				HeatCoolMode: false,
				StatusEcoC: false,
				StatusPreCool: false,
				CoolingDisabled: false,
				DewPointStatus: false,
				FrostAlarm: false,
				OverheatAlarm: false,
				reserved: false,
			}
			const result = DPT22.formatAPDU(value)
			assert.deepEqual(result, Buffer.from([0x00, 0x00]))
		})

		test('should correctly format all flags set to true', () => {
			const value = {
				Fault: true,
				StatusEcoH: true,
				TempFlowLimit: true,
				TempReturnLimit: true,
				StatusMorningBoostH: true,
				StatusStartOptim: true,
				StatusStopOptim: true,
				HeatingDisabled: true,
				HeatCoolMode: true,
				StatusEcoC: true,
				StatusPreCool: true,
				CoolingDisabled: true,
				DewPointStatus: true,
				FrostAlarm: true,
				OverheatAlarm: true,
				reserved: true,
			}
			const result = DPT22.formatAPDU(value)
			assert.deepEqual(result, Buffer.from([0xff, 0xff]))
		})

		test('should correctly format mixed flags', () => {
			const value = {
				Fault: true,
				StatusEcoH: false,
				TempFlowLimit: true,
				TempReturnLimit: false,
				StatusMorningBoostH: true,
				StatusStartOptim: false,
				StatusStopOptim: true,
				HeatingDisabled: false,
				HeatCoolMode: true,
				StatusEcoC: false,
				StatusPreCool: true,
				CoolingDisabled: false,
				DewPointStatus: true,
				FrostAlarm: false,
				OverheatAlarm: true,
				reserved: false,
			}
			const result = DPT22.formatAPDU(value)
			assert.deepEqual(result, Buffer.from([0x55, 0x55]))
		})

		test('should handle partial object with missing properties', () => {
			const partialValue = {
				Fault: true,
				HeatingDisabled: true,
				// All other properties missing
			}
			const result = DPT22.formatAPDU(partialValue)
			// Missing properties should default to false, except reserved which defaults to true
			assert.deepEqual(result, Buffer.from([0x80, 0x81]))
		})
	})

	describe('fromBuffer', () => {
		test('should correctly parse buffer with all flags false', () => {
			const result = DPT22.fromBuffer(Buffer.from([0x00, 0x00]))
			const expected = {
				Fault: false,
				StatusEcoH: false,
				TempFlowLimit: false,
				TempReturnLimit: false,
				StatusMorningBoostH: false,
				StatusStartOptim: false,
				StatusStopOptim: false,
				HeatingDisabled: false,
				HeatCoolMode: false,
				StatusEcoC: false,
				StatusPreCool: false,
				CoolingDisabled: false,
				DewPointStatus: false,
				FrostAlarm: false,
				OverheatAlarm: false,
				reserved: false,
			}
			assert.deepEqual(result, expected)
		})

		test('should correctly parse buffer with all flags true', () => {
			const result = DPT22.fromBuffer(Buffer.from([0xff, 0xff]))
			const expected = {
				Fault: true,
				StatusEcoH: true,
				TempFlowLimit: true,
				TempReturnLimit: true,
				StatusMorningBoostH: true,
				StatusStartOptim: true,
				StatusStopOptim: true,
				HeatingDisabled: true,
				HeatCoolMode: true,
				StatusEcoC: true,
				StatusPreCool: true,
				CoolingDisabled: true,
				DewPointStatus: true,
				FrostAlarm: true,
				OverheatAlarm: true,
				reserved: true,
			}
			assert.deepEqual(result, expected)
		})

		test('should correctly parse buffer with alternating flags', () => {
			const result = DPT22.fromBuffer(Buffer.from([0x55, 0x55]))
			const expected = {
				Fault: true,
				StatusEcoH: false,
				TempFlowLimit: true,
				TempReturnLimit: false,
				StatusMorningBoostH: true,
				StatusStartOptim: false,
				StatusStopOptim: true,
				HeatingDisabled: false,
				HeatCoolMode: true,
				StatusEcoC: false,
				StatusPreCool: true,
				CoolingDisabled: false,
				DewPointStatus: true,
				FrostAlarm: false,
				OverheatAlarm: true,
				reserved: false,
			}
			assert.deepEqual(result, expected)
		})

		test('should handle invalid buffer lengths', () => {
			assert.equal(DPT22.fromBuffer(Buffer.from([])), null)
			assert.equal(DPT22.fromBuffer(Buffer.from([0x00])), null)
			assert.equal(
				DPT22.fromBuffer(Buffer.from([0x00, 0x00, 0x00])),
				null,
			)
		})
	})
})
