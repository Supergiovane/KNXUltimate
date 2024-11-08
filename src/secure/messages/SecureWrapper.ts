import { KNX_SECURE } from '../SecureConstants'
import KNXHeader from '../../protocol/KNXHeader'
import {
	SecurityUtils,
	MessageType,
	KNXSecureConfig,
} from '../crypto/SecurityUtils'

/**
 * Implements KNX Secure Wrapper according to ISO 22510:2019
 */
export default class SecureWrapper {
	private readonly header: KNXHeader

	constructor(
		public readonly sessionId: number,
		public readonly sequenceInfo: number,
		public readonly serialNumber: number,
		public readonly messageTag: number,
		public readonly encapsulatedData: Buffer,
		public readonly messageAuthenticationCode: Buffer,
	) {
		// Validate fields
		if (messageAuthenticationCode.length !== KNX_SECURE.CRYPTO.MAC_LENGTH) {
			throw new Error(KNX_SECURE.ERROR.INVALID_MAC_LENGTH)
		}

		// Calculate total frame length
		const totalLength = 32 + (encapsulatedData?.length || 0) // Fixed fields + data
		if (totalLength > KNX_SECURE.FRAME.MAX_PAYLOAD_LENGTH) {
			throw new Error(KNX_SECURE.ERROR.PAYLOAD_TOO_LONG)
		}

		// Create header
		this.header = new KNXHeader(
			KNX_SECURE.SERVICE_TYPE.SECURE_WRAPPER,
			totalLength - KNX_SECURE.FRAME.HEADER_SIZE,
		)
	}

	static wrap(
		data: Buffer,
		sessionId: number,
		sequenceInfo: number,
		serialNumber: number,
		messageTag: number,
		sessionKey: Buffer,
	): SecureWrapper {
		// Create header for secure wrapper
		const header = new KNXHeader(
			KNX_SECURE.SERVICE_TYPE.SECURE_WRAPPER,
			data.length + 26, // data + fixed fields (without header)
		)

		// Prepare data for encryption
		const secureData = {
			messageType: MessageType.SECURE_WRAPPER,
			knxHeader: header.toBuffer(),
			secureSessionId: Buffer.alloc(2),
			encapsulatedFrame: data,
		}
		secureData.secureSessionId.writeUInt16BE(sessionId, 0)

		// Encrypt with secure config
		const config: KNXSecureConfig = {
			channelId: sessionId,
			sequenceNumber: sequenceInfo,
			serialNumber,
			messageTag,
			messageType: MessageType.SECURE_WRAPPER,
		}

		const { ciphertext, mac } = SecurityUtils.encrypt(
			secureData,
			sessionKey,
			config,
		)

		return new SecureWrapper(
			sessionId,
			sequenceInfo,
			serialNumber,
			messageTag,
			ciphertext,
			mac,
		)
	}

	static unwrap(wrapper: SecureWrapper, sessionKey: Buffer): Buffer {
		const secureData = {
			messageType: MessageType.SECURE_WRAPPER,
			knxHeader: wrapper.header.toBuffer(),
			secureSessionId: Buffer.alloc(2),
			encapsulatedFrame: wrapper.encapsulatedData,
		}
		secureData.secureSessionId.writeUInt16BE(wrapper.sessionId, 0)

		const config: KNXSecureConfig = {
			channelId: wrapper.sessionId,
			sequenceNumber: wrapper.sequenceInfo,
			serialNumber: wrapper.serialNumber,
			messageTag: wrapper.messageTag,
			messageType: MessageType.SECURE_WRAPPER,
		}

		return SecurityUtils.decrypt(
			wrapper.encapsulatedData,
			wrapper.messageAuthenticationCode,
			secureData,
			sessionKey,
			config,
		)
	}

	static createFromBuffer(buffer: Buffer): SecureWrapper {
		// Parse KNXnet/IP header
		const header = KNXHeader.createFromBuffer(buffer)

		// Validate service type
		if (header.service_type !== KNX_SECURE.SERVICE_TYPE.SECURE_WRAPPER) {
			throw new Error('Invalid service type for secure wrapper')
		}

		// Calculate minimum frame length
		const minLength = KNX_SECURE.FRAME.HEADER_SIZE + 26 // Header + fixed fields
		if (buffer.length < minLength) {
			throw new Error(KNX_SECURE.ERROR.INVALID_BUFFER_LENGTH)
		}

		let offset = header.headerLength

		// Parse fixed fields
		const sessionId = buffer.readUInt16BE(offset)
		offset += 2

		const sequenceInfo = buffer.readUIntBE(offset, 6)
		offset += 6

		const serialNumber = buffer.readUIntBE(offset, 6)
		offset += 6

		const messageTag = buffer.readUInt16BE(offset)
		offset += 2

		// Extract data and MAC
		const dataLength = buffer.length - offset - KNX_SECURE.CRYPTO.MAC_LENGTH
		const encapsulatedData =
			dataLength > 0
				? buffer.subarray(offset, offset + dataLength)
				: Buffer.alloc(0)

		const mac = buffer.subarray(
			buffer.length - KNX_SECURE.CRYPTO.MAC_LENGTH,
		)

		return new SecureWrapper(
			sessionId,
			sequenceInfo,
			serialNumber,
			messageTag,
			encapsulatedData,
			mac,
		)
	}

	toBuffer(): Buffer {
		const headerBuffer = this.header.toBuffer()

		const totalLength =
			headerBuffer.length + 26 + (this.encapsulatedData?.length || 0)

		const buffer = Buffer.alloc(totalLength)

		headerBuffer.copy(buffer, 0)
		let offset = headerBuffer.length

		buffer.writeUInt16BE(this.sessionId, offset)
		offset += 2

		buffer.writeUIntBE(this.sequenceInfo, offset, 6)
		offset += 6

		buffer.writeUIntBE(this.serialNumber, offset, 6)
		offset += 6

		buffer.writeUInt16BE(this.messageTag, offset)
		offset += 2

		// Write encrypted data if present
		if (this.encapsulatedData?.length > 0) {
			this.encapsulatedData.copy(buffer, offset)
			offset += this.encapsulatedData.length
		}

		// Write MAC
		this.messageAuthenticationCode.copy(buffer, offset)

		return buffer
	}

	get headerLength(): number {
		return this.header.headerLength
	}

	get version(): number {
		return this.header.version
	}

	toHeader(): KNXHeader {
		return this.header
	}
}
