import { EventEmitter } from 'events'
import SecureSession, {
	SecureSessionOptions,
	SecureSessionState,
} from './SecureSession'
import {
	SessionRequest,
	SessionResponse,
	SessionAuthenticate,
	SessionStatus,
} from './messages/SessionMessages'
import SecureWrapper from './messages/SecureWrapper'
import { KNX_SECURE } from './SecureConstants'
import KNXTunnellingRequest from '../protocol/KNXTunnellingRequest'
import KNXConnectRequest from '../protocol/KNXConnectRequest'
import KNXDisconnectRequest from '../protocol/KNXDisconnectRequest'
import TunnelCRI from '../protocol/TunnelCRI'
import HPAI from '../protocol/HPAI'
import { KNX_CONSTANTS } from '../protocol/KNXConstants'
import KNXHeader from '../protocol/KNXHeader'

export interface KNXSecureTunnellingEvents {
	established: () => void
	closed: (reason?: string) => void
	error: (error: Error) => void
	tunnellingRequest: (request: KNXTunnellingRequest) => void
	send: (wrapper: SecureWrapper) => void
}

export default class KNXSecureTunnelling extends EventEmitter {
	private session: SecureSession

	private channelId: number = null

	private sequenceNumber: number = 0

	constructor(private readonly options: SecureSessionOptions) {
		super()
		this.session = new SecureSession(options)

		// Forward session events
		this.session.on('authenticated', () => {
			this.sendSecureConnectRequest()
		})

		this.session.on('error', (error: Error) => {
			this.emit('error', error)
		})

		this.session.on('close', (reason: string) => {
			this.channelId = null
			this.emit('closed', reason)
		})

		this.session.on('timeout', (reason: string) => {
			this.close(`Session timeout: ${reason}`)
		})
	}

	/**
	 * Start secure tunnelling connection
	 */
	public connect(
		tunnelType: number = KNX_CONSTANTS.TUNNEL_LINKLAYER,
	): SessionRequest {
		if (this.session.isAuthenticated) {
			throw new Error('Session already established')
		}
		return this.session.start()
	}

	/**
	 * Close secure tunnelling connection
	 */
	public close(reason?: string): void {
		if (this.channelId !== null) {
			// Send disconnect request before closing session
			const disconnectRequest = new KNXDisconnectRequest(this.channelId)
			this.sendSecureRequest(disconnectRequest)
		}
		this.session.close(reason)
	}

	/**
	 * Handle secure session response
	 */
	public handleSessionResponse(
		response: SessionResponse,
	): SessionAuthenticate {
		return this.session.handleSessionResponse(response)
	}

	/**
	 * Handle secure session status
	 */
	public handleSessionStatus(status: SessionStatus): void {
		this.session.handleSessionStatus(status)
	}

	/**
	 * Handle secure connect response
	 */
	public handleConnectResponse(channelId: number): void {
		if (!this.session.isAuthenticated) {
			throw new Error('Session not authenticated')
		}
		this.channelId = channelId
		this.emit('established')
	}

	/**
	 * Send secure tunnelling request
	 */
	public sendTunnellingRequest(request: KNXTunnellingRequest): void {
		if (!this.isEstablished) {
			throw new Error('Tunnel not established')
		}

		// Update sequence counter
		request.seqCounter = this.sequenceNumber++
		if (this.sequenceNumber > 255) {
			this.sequenceNumber = 0
		}

		this.sendSecureRequest(request)
	}

	/**
	 * Handle secure wrapper response
	 */
	public handleSecureWrapper(wrapper: SecureWrapper): void {
		if (!this.session.isAuthenticated) {
			throw new Error('Session not authenticated')
		}

		try {
			// Unwrap encrypted data
			const data = this.session.unwrapData(wrapper)

			// Parse KNX message from unwrapped data
			const serviceType = data.readUInt16BE(2) // Service type is at offset 2 in KNX header

			switch (serviceType) {
				case KNX_CONSTANTS.TUNNELLING_REQUEST: {
					const request = KNXTunnellingRequest.createFromBuffer(
						data.subarray(6),
					) // Skip KNX header
					this.emit('tunnellingRequest', request)
					break
				}

				case KNX_CONSTANTS.DISCONNECT_REQUEST:
					this.close('Disconnect requested by peer')
					break

				// Add handling for other secure service types as needed
			}
		} catch (error) {
			this.emit('error', error)
		}
	}

	private sendSecureConnectRequest(): void {
		// Create connect request with tunnel connection info
		const cri = new TunnelCRI(KNX_CONSTANTS.TUNNEL_LINKLAYER)
		const hpai = HPAI.NULLHPAI // Use null HPAI as we're using TCP
		const connectRequest = new KNXConnectRequest(cri, hpai, hpai)

		this.sendSecureRequest(connectRequest)
	}

	private sendSecureRequest(
		request:
			| KNXConnectRequest
			| KNXTunnellingRequest
			| KNXDisconnectRequest,
	): void {
		const header = new KNXHeader(
			request.header.service_type,
			request.toBuffer().length,
		)
		const data = Buffer.concat([header.toBuffer(), request.toBuffer()])

		// Wrap request in secure wrapper
		const wrapper = this.session.wrapData(data)
		this.emit('send', wrapper)
	}

	public get isEstablished(): boolean {
		return this.session.isAuthenticated && this.channelId !== null
	}

	public get secureSessionId(): number {
		return this.session.currentSessionId
	}
}
