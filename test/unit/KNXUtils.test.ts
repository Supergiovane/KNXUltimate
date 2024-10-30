import { describe, it } from 'node:test'
import assert from 'assert'
import { splitIP, validateKNXAddress } from '../../src/protocol/KNXUtils'

describe('KNXUtils', () => {
	describe('splitIP', () => {
		it('should correctly split a valid IP address', () => {
			const result = splitIP('192.168.1.1')
			assert.deepStrictEqual(result.slice(1), ['192', '168', '1', '1'])
		})

		it('should throw an error for invalid IP address', () => {
			assert.throws(() => {
				splitIP('invalid_ip')
			}, /Invalid ip format - invalid_ip/)
		})

		it('should throw an error when IP is undefined', () => {
			assert.throws(() => {
				splitIP(undefined as any)
			}, /ip undefined/)
		})

		it('should use custom name in error message when provided', () => {
			assert.throws(() => {
				splitIP('invalid_ip', 'customName')
			}, /Invalid customName format - invalid_ip/)
		})

		it('should handle IP addresses with leading zeros', () => {
			const result = splitIP('001.002.003.004')
			assert.deepStrictEqual(result.slice(1), [
				'001',
				'002',
				'003',
				'004',
			])
		})

		it('should throw an error for incomplete IP addresses', () => {
			assert.throws(() => {
				splitIP('192.168.1')
			}, /Invalid ip format - 192.168.1/)
		})
	})

	describe('validateKNXAddress', () => {
		describe('Group Addresses', () => {
			it('should validate correct 3-level group addresses', () => {
				assert.strictEqual(validateKNXAddress('0/0/1', true), 1)
				assert.strictEqual(validateKNXAddress('31/7/255', true), 65535)
			})

			it('should throw an error for invalid 3-level group addresses', () => {
				assert.throws(() => {
					validateKNXAddress('32/0/0', true)
				}, /Invalid 3 levels GA digit 32 inside address: 32\/0\/0/)

				assert.throws(() => {
					validateKNXAddress('0/8/0', true)
				}, /Invalid 3 levels GA digit 8 inside address: 0\/8\/0/)
			})

			it('should throw an error for invalid 2-level group addresses', () => {
				assert.throws(() => {
					validateKNXAddress('32/0', true)
				}, /Invalid 2 levels GA digit 32 inside address: 32\/0/)

				assert.throws(() => {
					validateKNXAddress('0/2048', true)
				}, /Invalid 2 levels GA digit 2048 inside address: 0\/2048/)
			})

			it('should throw an error for 0/0/0 group address', () => {
				assert.throws(() => {
					validateKNXAddress('0/0/0', true)
				}, /Invalid address: 0\/0\/0/)
			})
		})

		describe('Individual Addresses', () => {
			it('should validate correct individual addresses', () => {
				assert.strictEqual(validateKNXAddress('0.0.1'), 1)
				assert.strictEqual(validateKNXAddress('15.15.255'), 65535)
			})

			it('should throw an error for invalid individual addresses', () => {
				assert.throws(() => {
					validateKNXAddress('16.0.0')
				}, /Invalid Individual Address digit 16 inside address: 16.0.0/)

				assert.throws(() => {
					validateKNXAddress('0.0.256')
				}, /Invalid Individual Address digit 256 inside address: 0.0.256/)
			})
		})

		describe('Numeric Input', () => {
			it('should handle valid numeric input', () => {
				assert.strictEqual(validateKNXAddress(1), 1)
				assert.strictEqual(validateKNXAddress(65535), 65535)
			})

			it('should throw an error for invalid numeric input', () => {
				assert.throws(() => {
					validateKNXAddress(-1)
				}, /Invalid address -1/)

				assert.throws(() => {
					validateKNXAddress(65536)
				}, /Invalid address 65536/)
			})
		})

		it('should throw an error for invalid address format', () => {
			assert.throws(() => {
				validateKNXAddress('1/2/3/4', true)
			}, /Invalid address format: 1\/2\/3\/4 Only 3 level addresses are allowed/)
		})
	})
})
