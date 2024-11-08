import KNXHeader from '../../protocol/KNXHeader'
import HPAI from '../../protocol/HPAI'
import { KNX_SECURE, SecureSessionStatus } from '../SecureConstants'

export class SessionRequest {
	constructor(
		public readonly controlEndpoint: HPAI,
		public readonly publicKey: Buffer, // Client's ECDH public value X (32 bytes)
	) {
		if (publicKey.length !== 32) {
			throw new Error('Public key must be 32 bytes')
		}
	}

	static createFromBuffer(buffer: Buffer): SessionRequest {
		if (buffer.length < 40) {
			// HPAI (8 bytes) + Public Key (32 bytes)
			throw new Error('Invalid buffer length for SessionRequest')
		}

		const hpai = HPAI.createFromBuffer(buffer)
		const publicKey = buffer.subarray(hpai.length, hpai.length + 32)

		return new SessionRequest(hpai, publicKey)
	}

	toBuffer(): Buffer {
		return Buffer.concat([this.controlEndpoint.toBuffer(), this.publicKey])
	}

	toHeader(): KNXHeader {
		return new KNXHeader(
			KNX_SECURE.SERVICE_TYPE.SESSION_REQUEST,
			this.toBuffer().length,
		)
	}
}

export class SessionResponse {
	constructor(
		public readonly sessionId: number, // 16-bit session identifier
		public readonly publicKey: Buffer, // Server's ECDH public value Y (32 bytes)
		public readonly messageAuthenticationCode: Buffer, // 16 bytes MAC
	) {
		if (publicKey.length !== 32) {
			throw new Error('Public key must be 32 bytes')
		}
		if (messageAuthenticationCode.length !== 16) {
			throw new Error('MAC must be 16 bytes')
		}
		if (sessionId === 0) {
			throw new Error('Session ID 0 is reserved for multicast')
		}
	}

	static createFromBuffer(buffer: Buffer): SessionResponse {
		if (buffer.length !== 50) {
			// Session ID (2) + Public Key (32) + MAC (16)
			throw new Error('Invalid buffer length for SessionResponse')
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
		return buffer
	}

	toHeader(): KNXHeader {
		return new KNXHeader(
			KNX_SECURE.SERVICE_TYPE.SESSION_RESPONSE,
			this.toBuffer().length,
		)
	}
}

export class SessionAuthenticate {
	constructor(
		public readonly userId: number, // 8-bit user identifier
		public readonly messageAuthenticationCode: Buffer, // 16 bytes MAC
	) {
		if (messageAuthenticationCode.length !== 16) {
			throw new Error('MAC must be 16 bytes')
		}
		if (userId === 0 || userId >= 0x80) {
			throw new Error('Invalid user ID (must be between 0x01 and 0x7F)')
		}
	}

	static createFromBuffer(buffer: Buffer): SessionAuthenticate {
		if (buffer.length !== 18) {
			// Reserved (1) + User ID (1) + MAC (16)
			throw new Error('Invalid buffer length for SessionAuthenticate')
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
		return buffer
	}

	toHeader(): KNXHeader {
		return new KNXHeader(
			KNX_SECURE.SERVICE_TYPE.SESSION_AUTHENTICATE,
			this.toBuffer().length,
		)
	}
}

export class SessionStatus {
	static readonly SERVICE_TYPE = KNX_SECURE.SERVICE_TYPE.SESSION_STATUS

	constructor(public readonly status: SecureSessionStatus) {}

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
		return buffer
	}

	toHeader(): KNXHeader {
		return new KNXHeader(SessionStatus.SERVICE_TYPE, this.toBuffer().length)
	}
}
