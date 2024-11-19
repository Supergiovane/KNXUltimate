import { describe, it } from 'node:test'
import assert from 'node:assert'
import SecureWrapper from '../../src/secure/messages/SecureWrapper'
import { KNX_SECURE } from '../../src/secure/SecureConstants'
import { KNX_CONSTANTS } from '../../src/protocol/KNXConstants'

describe('SecureWrapper', () => {
	// Test data setup
	const testData = {
		sessionId: 1,
		sequenceInfo: 123456,
		serialNumber: 987654,
		messageTag: 42,
		encapsulatedData: Buffer.from('test data'),
		sessionKey: Buffer.alloc(16, 1), // 16 byte test key filled with 1s
		mac: Buffer.alloc(KNX_SECURE.CRYPTO.MAC_LENGTH), // Valid length MAC
	}

	describe('Constructor', () => {
		it('should create valid instance with correct parameters', () => {
			const wrapper = new SecureWrapper(
				testData.sessionId,
				testData.sequenceInfo,
				testData.serialNumber,
				testData.messageTag,
				testData.encapsulatedData,
				testData.mac,
			)

			assert.strictEqual(wrapper.sessionId, testData.sessionId)
			assert.strictEqual(wrapper.sequenceInfo, testData.sequenceInfo)
			assert.strictEqual(wrapper.serialNumber, testData.serialNumber)
			assert.strictEqual(wrapper.messageTag, testData.messageTag)
			assert.deepStrictEqual(
				wrapper.encapsulatedData,
				testData.encapsulatedData,
			)
			assert.deepStrictEqual(
				wrapper.messageAuthenticationCode,
				testData.mac,
			)
		})

		it('should throw error for invalid MAC length', () => {
			const invalidMac = Buffer.alloc(8) // Invalid MAC length

			assert.throws(
				() =>
					new SecureWrapper(
						testData.sessionId,
						testData.sequenceInfo,
						testData.serialNumber,
						testData.messageTag,
						testData.encapsulatedData,
						invalidMac,
					),
				{
					message: KNX_SECURE.ERROR.INVALID_MAC_LENGTH,
				},
			)
		})

		it('should throw error for payload too long', () => {
			const longData = Buffer.alloc(
				KNX_SECURE.FRAME.MAX_PAYLOAD_LENGTH + 1,
			)

			assert.throws(
				() =>
					new SecureWrapper(
						testData.sessionId,
						testData.sequenceInfo,
						testData.serialNumber,
						testData.messageTag,
						longData,
						testData.mac,
					),
				{
					message: KNX_SECURE.ERROR.PAYLOAD_TOO_LONG,
				},
			)
		})
	})

	describe('Static wrap/unwrap methods', () => {
		it('should successfully wrap and unwrap data', () => {
			// Test data
			const originalData = Buffer.from('test data')

			// Wrap data
			const wrapper = SecureWrapper.wrap(
				originalData,
				testData.sessionId,
				testData.sequenceInfo,
				testData.serialNumber,
				testData.messageTag,
				testData.sessionKey,
			)

			// Verify wrapper properties
			assert.strictEqual(wrapper.sessionId, testData.sessionId)
			assert.strictEqual(wrapper.sequenceInfo, testData.sequenceInfo)
			assert.strictEqual(wrapper.serialNumber, testData.serialNumber)
			assert.strictEqual(wrapper.messageTag, testData.messageTag)
			assert.strictEqual(
				wrapper.messageAuthenticationCode.length,
				KNX_SECURE.CRYPTO.MAC_LENGTH,
			)

			// Convert to buffer and back to test serialization
			const buffer = wrapper.toBuffer()

			const recreatedWrapper = SecureWrapper.createFromBuffer(buffer)

			// Verify recreation
			assert.strictEqual(recreatedWrapper.sessionId, wrapper.sessionId)
			assert.strictEqual(
				recreatedWrapper.sequenceInfo,
				wrapper.sequenceInfo,
			)
			assert.strictEqual(
				recreatedWrapper.serialNumber,
				wrapper.serialNumber,
			)
			assert.strictEqual(recreatedWrapper.messageTag, wrapper.messageTag)
			assert.ok(
				recreatedWrapper.encapsulatedData.equals(
					wrapper.encapsulatedData,
				),
			)
			assert.ok(
				recreatedWrapper.messageAuthenticationCode.equals(
					wrapper.messageAuthenticationCode,
				),
			)

			// Unwrap and verify data
			const unwrappedData = SecureWrapper.unwrap(
				recreatedWrapper,
				testData.sessionKey,
			)

			// Final verification
			assert.ok(
				unwrappedData.equals(originalData),
				`Unwrapped data (${unwrappedData.toString('hex')}) does not match original data (${originalData.toString('hex')})`,
			)
		})

		it('should handle empty data correctly', () => {
			const emptyData = Buffer.alloc(0)

			// Wrap empty data
			const wrapper = SecureWrapper.wrap(
				emptyData,
				testData.sessionId,
				testData.sequenceInfo,
				testData.serialNumber,
				testData.messageTag,
				testData.sessionKey,
			)

			// Verify wrapper with empty data
			assert.strictEqual(wrapper.encapsulatedData.length, 0)
			assert.strictEqual(
				wrapper.messageAuthenticationCode.length,
				KNX_SECURE.CRYPTO.MAC_LENGTH,
			)

			// Unwrap and verify empty data
			const unwrappedData = SecureWrapper.unwrap(
				wrapper,
				testData.sessionKey,
			)
			assert.strictEqual(unwrappedData.length, 0)
		})

		it('should throw error for invalid session key', () => {
			const wrapper = SecureWrapper.wrap(
				testData.encapsulatedData,
				testData.sessionId,
				testData.sequenceInfo,
				testData.serialNumber,
				testData.messageTag,
				testData.sessionKey,
			)

			const wrongKey = Buffer.alloc(16, 2) // Different key

			assert.throws(() => SecureWrapper.unwrap(wrapper, wrongKey), {
				message: KNX_SECURE.ERROR.MAC_VERIFICATION,
			})
		})
	})

	describe('Buffer serialization', () => {
		it('should correctly serialize and deserialize', () => {
			// Create initial wrapper
			const wrapper = SecureWrapper.wrap(
				testData.encapsulatedData,
				testData.sessionId,
				testData.sequenceInfo,
				testData.serialNumber,
				testData.messageTag,
				testData.sessionKey,
			)

			// Convert to buffer and back
			const buffer = wrapper.toBuffer()
			const recreatedWrapper = SecureWrapper.createFromBuffer(buffer)

			// Verify all fields match
			assert.strictEqual(recreatedWrapper.sessionId, wrapper.sessionId)
			assert.strictEqual(
				recreatedWrapper.sequenceInfo,
				wrapper.sequenceInfo,
			)
			assert.strictEqual(
				recreatedWrapper.serialNumber,
				wrapper.serialNumber,
			)
			assert.strictEqual(recreatedWrapper.messageTag, wrapper.messageTag)
			assert.ok(
				recreatedWrapper.encapsulatedData.equals(
					wrapper.encapsulatedData,
				),
			)
			assert.ok(
				recreatedWrapper.messageAuthenticationCode.equals(
					wrapper.messageAuthenticationCode,
				),
			)
		})

		it('should create correct KNXnet/IP header', () => {
			const wrapper = SecureWrapper.wrap(
				testData.encapsulatedData,
				testData.sessionId,
				testData.sequenceInfo,
				testData.serialNumber,
				testData.messageTag,
				testData.sessionKey,
			)

			const buffer = wrapper.toBuffer()

			// Verify header fields
			assert.strictEqual(
				buffer.readUInt8(0),
				KNX_CONSTANTS.HEADER_SIZE_10,
			)
			assert.strictEqual(
				buffer.readUInt8(1),
				KNX_CONSTANTS.KNXNETIP_VERSION_10,
			)
			assert.strictEqual(
				buffer.readUInt16BE(2),
				KNX_SECURE.SERVICE_TYPE.SECURE_WRAPPER,
			)
			assert.strictEqual(buffer.readUInt16BE(4), buffer.length)
		})

		it('should throw error for invalid buffer length', () => {
			const shortBuffer = Buffer.alloc(KNX_SECURE.FRAME.HEADER_SIZE + 4) // Too short

			// Write valid header fields
			shortBuffer.writeUInt8(KNX_CONSTANTS.HEADER_SIZE_10, 0)
			shortBuffer.writeUInt8(KNX_CONSTANTS.KNXNETIP_VERSION_10, 1)
			shortBuffer.writeUInt16BE(KNX_SECURE.SERVICE_TYPE.SECURE_WRAPPER, 2)
			shortBuffer.writeUInt16BE(shortBuffer.length, 4)

			assert.throws(() => SecureWrapper.createFromBuffer(shortBuffer), {
				message: /Invalid buffer length/,
			})
		})

		it('should throw error for invalid service type', () => {
			const buffer = Buffer.alloc(KNX_SECURE.FRAME.HEADER_SIZE + 26)

			// Write header with invalid service type
			buffer.writeUInt8(KNX_CONSTANTS.HEADER_SIZE_10, 0)
			buffer.writeUInt8(KNX_CONSTANTS.KNXNETIP_VERSION_10, 1)
			buffer.writeUInt16BE(0x0001, 2) // Wrong service type
			buffer.writeUInt16BE(buffer.length, 4)

			assert.throws(() => SecureWrapper.createFromBuffer(buffer), {
				message: /Invalid service type/,
			})
		})
	})

	describe('Header methods', () => {
		const wrapper = SecureWrapper.wrap(
			testData.encapsulatedData,
			testData.sessionId,
			testData.sequenceInfo,
			testData.serialNumber,
			testData.messageTag,
			testData.sessionKey,
		)

		it('should return correct header length', () => {
			assert.strictEqual(
				wrapper.headerLength,
				KNX_CONSTANTS.HEADER_SIZE_10,
			)
		})

		it('should return correct protocol version', () => {
			assert.strictEqual(
				wrapper.version,
				KNX_CONSTANTS.KNXNETIP_VERSION_10,
			)
		})

		it('should return correct service type', () => {
			assert.strictEqual(
				wrapper.toHeader().service_type,
				KNX_SECURE.SERVICE_TYPE.SECURE_WRAPPER,
			)
		})

		it('should return correct total length in header', () => {
			const totalLength =
				KNX_CONSTANTS.HEADER_SIZE_10 +
				26 +
				wrapper.encapsulatedData.length
			assert.strictEqual(wrapper.toHeader().length, totalLength)
		})
	})
})
