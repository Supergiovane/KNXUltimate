import { EventEmitter } from 'events'
import { KNX_SECURE, SecureSessionStatus } from './SecureConstants'
import { SecurityUtils } from './crypto/SecurityUtils'
import {
	SessionRequest,
	SessionResponse,
	SessionAuthenticate,
	SessionStatus,
} from './messages/SessionMessages'
import SecureWrapper from './messages/SecureWrapper'

export enum SecureSessionState {
	INITIAL = 'INITIAL',
	AUTHENTICATING = 'AUTHENTICATING',
	AUTHENTICATED = 'AUTHENTICATED',
	CLOSED = 'CLOSED',
}

export interface SecureSessionOptions {
	deviceAuthCode: string
	userId: number
	password: string
	serialNumber: number
}

export interface SecureSessionEvents {
	authenticated: () => void
	error: (error: Error) => void
	timeout: (reason: string) => void
	close: (reason: string) => void
	status: (status: SessionStatus) => void
}

export default class SecureSession extends EventEmitter {
	private state: SecureSessionState = SecureSessionState.INITIAL

	private sessionId: number = 0

	private sequenceNumber: number = 0

	private messageTag: number = 0

	private sessionKey: Buffer

	private clientKeyPair: { publicKey: Buffer; privateKey: Buffer }

	private serverPublicKey: Buffer

	private readonly deviceAuthHash: Buffer

	private readonly passwordHash: Buffer

	private authenticationTimer: NodeJS.Timeout

	private sessionTimer: NodeJS.Timeout

	constructor(private readonly options: SecureSessionOptions) {
		super()

		// Validate user ID range
		if (
			options.userId < KNX_SECURE.USER.MANAGEMENT ||
			options.userId > KNX_SECURE.USER.USER_MAX
		) {
			throw new Error(KNX_SECURE.ERROR.INVALID_USER_ID)
		}

		// Derive authentication keys
		this.deviceAuthHash = SecurityUtils.deriveDeviceAuthenticationCode(
			options.deviceAuthCode,
		)
		this.passwordHash = SecurityUtils.derivePasswordHash(options.password)
	}

	public start(): SessionRequest {
		if (this.state !== SecureSessionState.INITIAL) {
			throw new Error('Session already started')
		}

		// Generate client ECDH keypair
		this.clientKeyPair = SecurityUtils.generateKeyPair()

		// Create session request
		const request = new SessionRequest(
			null, // HPAI is set by KNXClient
			this.clientKeyPair.publicKey,
		)

		// Start authentication timeout (10s)
		this.authenticationTimer = setTimeout(() => {
			this.handleTimeout('Authentication timeout')
		}, KNX_SECURE.TIMEOUT.AUTHENTICATION * 1000)

		this.state = SecureSessionState.AUTHENTICATING

		return request
	}

	public handleSessionResponse(
		response: SessionResponse,
	): SessionAuthenticate {
		if (this.state !== SecureSessionState.AUTHENTICATING) {
			throw new Error('Invalid state for session response')
		}

		// Verify device authentication with MAC
		if (
			!response.verifyMAC(
				this.deviceAuthHash,
				this.clientKeyPair.publicKey,
				this.options.serialNumber,
			)
		) {
			throw new Error(KNX_SECURE.ERROR.MAC_VERIFICATION)
		}

		// Store session parameters
		this.sessionId = response.sessionId
		this.serverPublicKey = response.publicKey

		// Calculate session key using ECDH
		this.sessionKey = SecurityUtils.calculateSessionKey(
			this.clientKeyPair.privateKey,
			this.serverPublicKey,
		)

		// Create user authentication request
		return SessionAuthenticate.create(
			this.options.userId,
			this.clientKeyPair.publicKey,
			this.serverPublicKey,
			this.passwordHash,
			this.options.serialNumber,
		)
	}

	public handleSessionStatus(status: SessionStatus): void {
		switch (status.status) {
			case SecureSessionStatus.AUTHENTICATION_SUCCESS:
				if (this.state === SecureSessionState.AUTHENTICATING) {
					clearTimeout(this.authenticationTimer)
					this.state = SecureSessionState.AUTHENTICATED
					this.startSessionTimer()
					this.emit('authenticated')
				}
				break

			case SecureSessionStatus.AUTHENTICATION_FAILED:
				this.state = SecureSessionState.CLOSED
				this.close('Authentication failed')
				break

			case SecureSessionStatus.UNAUTHENTICATED:
				this.close('Authentication failed')
				break

			case SecureSessionStatus.TIMEOUT:
				this.state = SecureSessionState.CLOSED
				this.close('Session timeout')
				break

			case SecureSessionStatus.CLOSE:
				this.close('Session closed by peer')
				break

			case SecureSessionStatus.KEEPALIVE:
				this.resetSessionTimer()
				break
		}

		this.emit('status', status)
	}

	public wrapData(data: Buffer): SecureWrapper {
		if (this.state !== SecureSessionState.AUTHENTICATED) {
			throw new Error('Session not authenticated')
		}

		return SecureWrapper.wrap(
			data,
			this.sessionId,
			this.sequenceNumber++,
			this.options.serialNumber,
			this.messageTag++,
			this.sessionKey,
		)
	}

	public unwrapData(wrapper: SecureWrapper): Buffer {
		if (this.state !== SecureSessionState.AUTHENTICATED) {
			throw new Error('Session not authenticated')
		}

		if (wrapper.sessionId !== this.sessionId) {
			throw new Error('Invalid session ID')
		}

		// Validate sequence number
		if (
			!SecurityUtils.validateTunnelingSequence(
				wrapper.sequenceInfo,
				this.sequenceNumber,
			)
		) {
			throw new Error('Invalid sequence number')
		}

		this.resetSessionTimer()

		return SecureWrapper.unwrap(wrapper, this.sessionKey)
	}

	public close(reason?: string): void {
		clearTimeout(this.authenticationTimer)
		clearTimeout(this.sessionTimer)

		const previousState = this.state
		this.state = SecureSessionState.CLOSED

		this.emit('close', reason || 'Session closed')
	}

	private handleTimeout(reason: string): void {
		this.state = SecureSessionState.CLOSED
		this.emit('timeout', reason)
		this.close(reason)
	}

	private startSessionTimer(): void {
		this.sessionTimer = setTimeout(() => {
			this.handleTimeout('Session timeout')
		}, KNX_SECURE.TIMEOUT.SESSION * 1000)
	}

	private resetSessionTimer(): void {
		clearTimeout(this.sessionTimer)
		this.startSessionTimer()
	}

	public get isAuthenticated(): boolean {
		return this.state === SecureSessionState.AUTHENTICATED
	}

	public get currentSessionId(): number {
		return this.sessionId
	}

	public get currentSequenceNumber(): number {
		return this.sequenceNumber
	}
}
