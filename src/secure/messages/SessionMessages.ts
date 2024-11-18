import KNXHeader from '../../protocol/KNXHeader'
import HPAI from '../../protocol/HPAI'
import { KNX_SECURE, SecureSessionStatus } from '../SecureConstants'
import KNXPacket from '../../protocol/KNXPacket'
import {
	SecurityUtils,
	MessageType,
	SecureWrapperData,
} from '../crypto/SecurityUtils'

export class SessionRequest extends KNXPacket {
	constructor(
		public readonly controlEndpoint: HPAI,
		public readonly publicKey: Buffer, // Client's ECDH public value X (32 bytes)
	) {
		// Calculate total length and call parent constructor with type and length
		const length = controlEndpoint.length + publicKey.length
		super(KNX_SECURE.SERVICE_TYPE.SESSION_REQUEST, length)

		if (publicKey.length !== 32) {
			throw new Error(KNX_SECURE.ERROR.INVALID_KEY_LENGTH)
		}
	}

	static createFromBuffer(buffer: Buffer): SessionRequest {
		if (buffer.length < 40) {
			// HPAI (8 bytes) + Public Key (32 bytes)
			throw new Error(KNX_SECURE.ERROR.INVALID_BUFFER_LENGTH)
		}

		const hpai = HPAI.createFromBuffer(buffer)
		const publicKey = buffer.subarray(hpai.length, hpai.length + 32)

		return new SessionRequest(hpai, publicKey)
	}

	toBuffer(): Buffer {
		return Buffer.concat([
			this.header.toBuffer(),
			this.controlEndpoint.toBuffer(),
			this.publicKey,
		])
	}
}

export class SessionResponse extends KNXPacket {
	constructor(
		public readonly sessionId: number,
		public readonly publicKey: Buffer,
		public readonly messageAuthenticationCode: Buffer,
	) {
		// Fixed length: sessionId(2) + publicKey(32) + MAC(16)
		super(KNX_SECURE.SERVICE_TYPE.SESSION_RESPONSE, 50)

		if (publicKey.length !== 32) {
			throw new Error(KNX_SECURE.ERROR.INVALID_KEY_LENGTH)
		}
		if (messageAuthenticationCode.length !== KNX_SECURE.CRYPTO.MAC_LENGTH) {
			throw new Error(KNX_SECURE.ERROR.INVALID_MAC_LENGTH)
		}
		if (sessionId === 0) {
			throw new Error(KNX_SECURE.ERROR.MULTICAST_SESSION_ID)
		}
	}

	static create(
		sessionId: number,
		serverPublicKey: Buffer,
		clientPublicKey: Buffer,
		deviceAuthCode: Buffer,
		serialNumber: number,
	): SessionResponse {
		const secureData: SecureWrapperData = {
			messageType: MessageType.SESSION_RESPONSE,
			knxHeader: new KNXPacket(
				KNX_SECURE.SERVICE_TYPE.SESSION_RESPONSE,
				50,
			).header.toBuffer(),
			secureSessionId: Buffer.alloc(2),
			dhPublicX: clientPublicKey,
			dhPublicY: serverPublicKey,
		}

		secureData.secureSessionId.writeUInt16BE(sessionId, 0)

		const { mac } = SecurityUtils.encrypt(secureData, deviceAuthCode, {
			channelId: sessionId,
			sequenceNumber: 0,
			serialNumber,
			messageTag: 0,
			messageType: MessageType.SESSION_RESPONSE,
		})

		return new SessionResponse(sessionId, serverPublicKey, mac)
	}

	verifyMAC(
		deviceAuthCode: Buffer,
		clientPublicKey: Buffer,
		serialNumber: number,
	): boolean {
		const secureData: SecureWrapperData = {
			messageType: MessageType.SESSION_RESPONSE,
			knxHeader: this.header.toBuffer(),
			secureSessionId: Buffer.alloc(2),
			dhPublicX: clientPublicKey,
			dhPublicY: this.publicKey,
		}

		secureData.secureSessionId.writeUInt16BE(this.sessionId, 0)

		try {
			const { mac } = SecurityUtils.encrypt(secureData, deviceAuthCode, {
				channelId: this.sessionId,
				sequenceNumber: 0,
				serialNumber,
				messageTag: 0,
				messageType: MessageType.SESSION_RESPONSE,
			})

			return mac.equals(this.messageAuthenticationCode)
		} catch (error) {
			return false
		}
	}

	static createFromBuffer(buffer: Buffer): SessionResponse {
		if (buffer.length !== 50) {
			throw new Error(KNX_SECURE.ERROR.INVALID_BUFFER_LENGTH)
		}

		const sessionId = buffer.readUInt16BE(0)
		const publicKey = buffer.subarray(2, 34)
		const mac = buffer.subarray(34, 50)

		return new SessionResponse(sessionId, publicKey, mac)
	}

	toBuffer(): Buffer {
		const buffer = Buffer.alloc(50)
		buffer.writeUInt16BE(this.sessionId, 0)
		this.publicKey.copy(buffer, 2)
		this.messageAuthenticationCode.copy(buffer, 34)
		return Buffer.concat([this.header.toBuffer(), buffer])
	}
}

export class SessionAuthenticate extends KNXPacket {
	constructor(
		public readonly userId: number,
		public readonly messageAuthenticationCode: Buffer,
	) {
		// Fixed length: reserved(1) + userId(1) + MAC(16)
		super(KNX_SECURE.SERVICE_TYPE.SESSION_AUTHENTICATE, 18)

		if (messageAuthenticationCode.length !== KNX_SECURE.CRYPTO.MAC_LENGTH) {
			throw new Error(KNX_SECURE.ERROR.INVALID_MAC_LENGTH)
		}
		if (
			userId < KNX_SECURE.USER.MANAGEMENT ||
			userId > KNX_SECURE.USER.USER_MAX
		) {
			throw new Error(KNX_SECURE.ERROR.INVALID_USER_ID)
		}
	}

	static create(
		userId: number,
		clientPublicKey: Buffer,
		serverPublicKey: Buffer,
		passwordHash: Buffer,
		serialNumber: number,
	): SessionAuthenticate {
		const userIdBuffer = Buffer.alloc(2)
		userIdBuffer.writeUInt8(KNX_SECURE.USER.RESERVED, 0)
		userIdBuffer.writeUInt8(userId, 1)

		const secureData: SecureWrapperData = {
			messageType: MessageType.SESSION_AUTHENTICATE,
			knxHeader: new KNXPacket(
				KNX_SECURE.SERVICE_TYPE.SESSION_AUTHENTICATE,
				18,
			).header.toBuffer(),
			secureSessionId: userIdBuffer,
			dhPublicX: clientPublicKey,
			dhPublicY: serverPublicKey,
			userId,
		}

		const { mac } = SecurityUtils.encrypt(secureData, passwordHash, {
			channelId: 0,
			sequenceNumber: 0,
			serialNumber,
			messageTag: 0,
			messageType: MessageType.SESSION_AUTHENTICATE,
		})

		return new SessionAuthenticate(userId, mac)
	}

	verifyMAC(
		passwordHash: Buffer,
		clientPublicKey: Buffer,
		serverPublicKey: Buffer,
		serialNumber: number,
	): boolean {
		const userIdBuffer = Buffer.alloc(2)
		userIdBuffer.writeUInt8(KNX_SECURE.USER.RESERVED, 0)
		userIdBuffer.writeUInt8(this.userId, 1)

		const secureData: SecureWrapperData = {
			messageType: MessageType.SESSION_AUTHENTICATE,
			knxHeader: this.header.toBuffer(),
			secureSessionId: userIdBuffer,
			dhPublicX: clientPublicKey,
			dhPublicY: serverPublicKey,
			userId: this.userId,
		}

		try {
			const { mac } = SecurityUtils.encrypt(secureData, passwordHash, {
				channelId: 0,
				sequenceNumber: 0,
				serialNumber,
				messageTag: 0,
				messageType: MessageType.SESSION_AUTHENTICATE,
			})

			return mac.equals(this.messageAuthenticationCode)
		} catch (error) {
			return false
		}
	}

	static createFromBuffer(buffer: Buffer): SessionAuthenticate {
		if (buffer.length !== 18) {
			throw new Error(KNX_SECURE.ERROR.INVALID_BUFFER_LENGTH)
		}

		const reserved = buffer.readUInt8(0)
		if (reserved !== KNX_SECURE.USER.RESERVED) {
			throw new Error(KNX_SECURE.ERROR.RESERVED_BYTE)
		}

		const userId = buffer.readUInt8(1)
		const mac = buffer.subarray(2, 18)

		return new SessionAuthenticate(userId, mac)
	}

	toBuffer(): Buffer {
		const buffer = Buffer.alloc(18)
		buffer.writeUInt8(KNX_SECURE.USER.RESERVED, 0)
		buffer.writeUInt8(this.userId, 1)
		this.messageAuthenticationCode.copy(buffer, 2)
		return Buffer.concat([this.header.toBuffer(), buffer])
	}
}

export class SessionStatus extends KNXPacket {
	constructor(public readonly status: SecureSessionStatus) {
		super(KNX_SECURE.SERVICE_TYPE.SESSION_STATUS, 1)
	}

	static createFromBuffer(buffer: Buffer): SessionStatus {
		if (buffer.length !== 1) {
			throw new Error(KNX_SECURE.ERROR.SESSION_STATUS_INVALID_BUFFER)
		}

		const status = buffer.readUInt8(0)
		if (!(status in SecureSessionStatus)) {
			throw new Error(`Invalid status code: ${status}`)
		}

		return new SessionStatus(status)
	}

	toBuffer(): Buffer {
		const buffer = Buffer.alloc(1)
		buffer.writeUInt8(this.status, 0)
		return Buffer.concat([this.header.toBuffer(), buffer])
	}
}
