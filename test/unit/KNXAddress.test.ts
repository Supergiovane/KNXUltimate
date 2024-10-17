import { describe, it, beforeEach } from 'node:test'
import assert from 'assert'
import KNXAddress, { KNXAddressType } from '../../src/protocol/KNXAddress'

describe('KNXAddress', () => {
	describe('createFromString', () => {
		it('should correctly create an individual KNX address from a string', () => {
			const address = KNXAddress.createFromString(
				'1.1.1',
				KNXAddressType.TYPE_INDIVIDUAL,
			)
			assert.strictEqual(address.toString(), '1.1.1')
			assert.strictEqual(address.get(), 0x1101) // 4353 in decimal
		})

		it('should correctly create a group KNX address from a string', () => {
			const address = KNXAddress.createFromString(
				'1/1/1',
				KNXAddressType.TYPE_GROUP,
			)
			assert.strictEqual(address.toString(), '1/1/1')
			assert.strictEqual(address.get(), 0x0901) // 2305 in decimal
		})

		it('should throw an error for an invalid individual KNX address string', () => {
			assert.throws(() => {
				KNXAddress.createFromString(
					'16.1.1',
					KNXAddressType.TYPE_INDIVIDUAL,
				)
			}, /Invalid Individual Address digit/)
		})

		it('should throw an error for an invalid group KNX address string', () => {
			assert.throws(() => {
				KNXAddress.createFromString('32/1/1', KNXAddressType.TYPE_GROUP)
			}, /Invalid 3 levels GA digit 32 inside address: 32\/1\/1/)
		})
	})

	describe('createFromBuffer', () => {
		it('should correctly create an individual KNX address from a buffer', () => {
			const buffer = Buffer.from([0x11, 0x01])
			const address = KNXAddress.createFromBuffer(
				buffer,
				0,
				KNXAddressType.TYPE_INDIVIDUAL,
			)
			assert.strictEqual(address.toString(), '1.1.1')
			assert.strictEqual(address.get(), 0x1101)
		})

		it('should correctly create a group KNX address from a buffer', () => {
			const buffer = Buffer.from([0x09, 0x01])
			const address = KNXAddress.createFromBuffer(
				buffer,
				0,
				KNXAddressType.TYPE_GROUP,
			)
			assert.strictEqual(address.toString(), '1/1/1')
			assert.strictEqual(address.get(), 0x0901)
		})

		it('should throw an error when buffer is too small', () => {
			const buffer = Buffer.from([0x11])
			assert.throws(() => {
				KNXAddress.createFromBuffer(
					buffer,
					0,
					KNXAddressType.TYPE_INDIVIDUAL,
				)
			}, /offset 0 out of buffer range 1/)
		})
	})

	describe('set and get', () => {
		let address: KNXAddress

		beforeEach(() => {
			address = new KNXAddress(0x1111)
		})

		it('should correctly set and get address', () => {
			address.set(0x2222)
			assert.strictEqual(address.get(), 0x2222)
		})

		it('should throw an error when setting an invalid address', () => {
			assert.throws(() => {
				address.set(0x10000)
			}, /Invalid address number/)
		})

		it('should throw an error when setting NaN', () => {
			assert.throws(() => {
				address.set(NaN)
			}, /Invalid address format/)
		})
	})

	describe('toString', () => {
		it('should correctly convert a 3-level individual address to string', () => {
			const address = new KNXAddress(
				0x1101,
				KNXAddressType.TYPE_INDIVIDUAL,
			)
			assert.strictEqual(address.toString(), '1.1.1')
		})

		it('should correctly convert a 3-level group address to string', () => {
			const address = new KNXAddress(0x0901, KNXAddressType.TYPE_GROUP)
			assert.strictEqual(address.toString(), '1/1/1')
		})
	})

	describe('toBuffer', () => {
		it('should correctly convert address to buffer', () => {
			const address = new KNXAddress(0x1111)
			const buffer = address.toBuffer()
			assert.strictEqual(buffer.length, 2)
			assert.strictEqual(buffer.readUInt16BE(0), 0x1111)
		})
	})
})
