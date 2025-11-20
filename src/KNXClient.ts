/**
 * Implements the main KNX client managing tunnelling and routing.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import dgram, { RemoteInfo, Socket as UDPSocket } from 'dgram'
import net, { Socket as TCPSocket } from 'net'
import * as crypto from 'crypto'
import { ConnectionStatus, KNX_CONSTANTS } from './protocol/KNXConstants'
import CEMIConstants from './protocol/cEMI/CEMIConstants'
import CEMIFactory from './protocol/cEMI/CEMIFactory'
import CEMIMessage from './protocol/cEMI/CEMIMessage'
import KNXProtocol, { KnxMessage, KnxResponse } from './protocol/KNXProtocol'
import KNXConnectResponse from './protocol/KNXConnectResponse'
import HPAI, { KnxProtocol } from './protocol/HPAI'
import TunnelCRI, { TunnelTypes } from './protocol/TunnelCRI'
import KNXConnectionStateResponse from './protocol/KNXConnectionStateResponse'
import * as errors from './errors'
import * as ipAddressHelper from './util/ipAddressHelper'
import KNXAddress from './protocol/KNXAddress'
import KNXDataBuffer, { IDataPoint } from './protocol/KNXDataBuffer'
import * as DPTLib from './dptlib'
import KnxLog, {
	KNXLogger,
	LogLevel,
	module as createLogger,
	setLogLevel,
	KNXLoggerOptions,
} from './KnxLog'
import { KNXDescriptionResponse, KNXPacket } from './protocol'
import KNXRoutingIndication from './protocol/KNXRoutingIndication'
import KNXConnectRequest from './protocol/KNXConnectRequest'
import KNXTunnelingRequest from './protocol/KNXTunnelingRequest'
import { TypedEventEmitter } from './TypedEmitter'
import KNXHeader from './protocol/KNXHeader'
import KNXTunnelingAck from './protocol/KNXTunnelingAck'
import KNXSearchResponse from './protocol/KNXSearchResponse'
import KNXDisconnectResponse from './protocol/KNXDisconnectResponse'
import { wait, getTimestamp } from './utils'
import SerialFT12, {
	SerialFT12Options,
	SerialPortSummary,
} from './transports/SerialFT12'
import { performance } from 'perf_hooks'
// KNX Secure helpers (moved inlined usage from SecureTunnelTCP)
import { Keyring } from './secure/keyring'
import {
	calculateMessageAuthenticationCodeCBC,
	encryptDataCtr,
	decryptCtr,
} from './secure/security_primitives'
import {
	SCF_ENCRYPTION_S_A_DATA,
	KNXIP,
	CEMI as SEC_CEMI,
	APCI,
	APCI_SEC,
	TPCI_DATA,
	SECURE_WRAPPER_TAG,
	SECURE_WRAPPER_CTR_SUFFIX,
	SECURE_WRAPPER_MAC_SUFFIX,
	SECURE_WRAPPER_OVERHEAD,
	KNXIP_HDR_SECURE_WRAPPER,
	KNXIP_HDR_TUNNELING_REQUEST,
	KNXIP_HDR_TUNNELING_ACK,
	KNXIP_HDR_TUNNELING_CONNECT_REQUEST,
	KNXIP_HDR_SECURE_SESSION_REQUEST,
	KNXIP_HDR_SECURE_SESSION_AUTHENTICATE,
	DATA_SECURE_CTR_SUFFIX,
	AUTH_CTR_IV,
	CONNECT_SEND_DELAY_MS,
	DEFAULT_STATUS_TIMEOUT_MS,
	SECURE_SESSION_TIMEOUT_MS,
	SECURE_AUTH_TIMEOUT_MS,
	SECURE_CONNECT_TIMEOUT_MS,
	HPAI_CONTROL_ENDPOINT_EMPTY,
	HPAI_DATA_ENDPOINT_EMPTY,
	CRD_TUNNEL_LINKLAYER,
	TUNNEL_CONN_HEADER_LEN,
	TUNNELING_ACK_TOTAL_LEN,
	WAIT_FOR_STATUS_DEFAULT_MS,
	KNXIP_HEADER_LEN,
	DEFAULT_SRC_IA_FALLBACK,
	PUBLIC_KEY_LEN,
	SECURE_SEQ_LEN,
	AES_BLOCK_LEN,
	MAC_LEN_FULL,
	MAC_LEN_SHORT,
} from './secure/secure_knx_constants'

export type DiscoveryInterface = {
	ip: string
	port: number
	name: string
	ia: string
	services: string[]
	type: 'tunnelling' | 'routing'
	transport?: 'UDP' | 'TCP' | 'Multicast'
}

// Secure config moved here to avoid dependency on separate class file
export interface SecureConfig {
	tunnelInterfaceIndividualAddress?: string
	knxkeys_file_path?: string
	knxkeys_password?: string
	tunnelUserPassword?: string
	tunnelUserId?: number
}

export enum ConncetionState {
	STARTED = 'STARTED',
	CONNECTING = 'CONNECTING',
	CONNECTED = 'CONNECTED',
	DISCONNECTING = 'DISCONNECTING',
	DISCONNECTED = 'DISCONNECTED',
}

export enum SocketEvents {
	error = 'error',
	message = 'message',
	listening = 'listening',
	data = 'data',
	close = 'close',
	connect = 'connect',
}

export type KNXClientProtocol =
	| 'TunnelUDP'
	| 'Multicast'
	| 'TunnelTCP'
	| 'SerialFT12'

export enum KNXClientEvents {
	error = 'error',
	disconnected = 'disconnected',
	discover = 'discover',
	indication = 'indication',
	connected = 'connected',
	ready = 'ready',
	response = 'response',
	connecting = 'connecting',
	ackReceived = 'ackReceived',
	close = 'close',
	descriptionResponse = 'descriptionResponse',
}

export interface KNXClientEventCallbacks {
	error: (error: Error) => void
	disconnected: (reason: string) => void
	discover: (
		host: string,
		header: KNXHeader,
		message: KNXSearchResponse,
	) => void
	getGatewayDescription: (searchResponse: KNXDescriptionResponse) => void
	indication: (packet: KNXRoutingIndication, echoed: boolean) => void
	connected: (options: KNXClientOptions) => void
	ready: () => void
	response: (host: string, header: KNXHeader, message: KnxResponse) => void
	connecting: (options: KNXClientOptions) => void
	ackReceived: (
		packet: KNXTunnelingAck | KNXTunnelingRequest,
		ack: boolean,
	) => void
	close: () => void
	descriptionResponse: (packet: KNXDescriptionResponse) => void
}

export type KNXClientOptions = {
	/** The physical address to be identified in the KNX bus */
	physAddr?: string
	/** Connection keep alive timeout. Time after which the connection is closed if no ping received */
	connectionKeepAliveTimeout?: number
	/** The IP of your KNX router/interface (for Routers, use "224.0.23.12") */
	ipAddr?: string
	/** The port, default is "3671" */
	ipPort?: number | string
	/** Default: "TunnelUDP". "Multicast" if you're connecting to a KNX Router. "TunnelUDP" for KNX Interfaces, or "TunnelTCP" for secure KNX Interfaces (not yet implemented) */
	hostProtocol?: KNXClientProtocol
	/** True: Enables the secure connection. Leave false until KNX-Secure has been released. */
	isSecureKNXEnabled?: boolean
	/** Avoid sending/receive the ACK telegram. Leave false. If you encounter issues with old interface, set it to true */
	suppress_ack_ldatareq?: boolean
	/** The local IP address to be used to connect to the KNX/IP Bus. Leave blank, will be automatically filled by KNXUltimate */
	localIPAddress?: string
	/** Specifies the local eth interface to be used to connect to the KNX Bus. */
	interface?: string
	/** Local socket address. Automatically filled by KNXClient */
	localSocketAddress?: string
	// ** Local queue interval between each KNX telegram. Default is 1 telegram each 25ms
	KNXQueueSendIntervalMilliseconds?: number
	/** Enables sniffing mode to monitor KNX */
	sniffingMode?: boolean
	/** Sets the tunnel_endpoint with the localIPAddress instead of the standard 0.0.0.0 */
	theGatewayIsKNXVirtual?: boolean
	/** Optional configuration for KNX/IP Secure over TCP (handshake + Data Secure helpers). */
	secureTunnelConfig?: SecureConfig
	/** Secure multicast: wait to send until timer is authenticated (default: true) */
	secureRoutingWaitForTimer?: boolean
	/** Serial FT1.2 configuration (used when hostProtocol === 'SerialFT12') */
	serialInterface?: SerialFT12Options
} & KNXLoggerOptions

const optionsDefaults: KNXClientOptions = {
	physAddr: '',
	connectionKeepAliveTimeout: KNX_CONSTANTS.CONNECTION_ALIVE_TIME,
	ipAddr: '224.0.23.12',
	ipPort: 3671,
	hostProtocol: 'Multicast',
	isSecureKNXEnabled: false,
	suppress_ack_ldatareq: false,
	loglevel: 'info',
	localIPAddress: '',
	interface: '',
	KNXQueueSendIntervalMilliseconds: 25,
	theGatewayIsKNXVirtual: false,
	secureRoutingWaitForTimer: true,
}

export enum KNXTimer {
	/** Triggers when an ACK is not received in time */
	ACK = 'ack',
	/** Delay between heartbeats */
	HEARTBEAT = 'heartbeat',
	/** Triggers when no connection state response is received  */
	CONNECTION_STATE = 'connection_state',
	/** Waiting for a connect response */
	CONNECTION = 'connection',
	/** Delay before sending the connect request */
	CONNECT_REQUEST = 'connect_request',
	/** Delay after receiving a disconnect request */
	DISCONNECT = 'disconnect',
	/** Waits for discovery responses */
	DISCOVERY = 'discovery',
	/** Waits for the gateway description gather responses */
	GATEWAYDESCRIPTION = 'GatewayDescription',
}

export type SnifferPacket = {
	reqType?: string
	request?: string
	response?: string
	resType?: string
	/** Time in ms between this request and the previous */
	deltaReq: number
	/** Time in ms between the request and the response */
	deltaRes?: number
}

interface KNXQueueItem {
	knxPacket: KNXPacket
	ACK: KNXTunnelingRequest
	expectedSeqNumberForACK: number
}

export default class KNXClient extends TypedEventEmitter<KNXClientEventCallbacks> {
	private _channelID: number

	private _connectionState: string

	private _numFailedTelegramACK: number

	private _clientTunnelSeqNumber: number

	private _options: KNXClientOptions

	private _peerHost: string

	private _peerPort: number

	private _heartbeatFailures: number

	private _heartbeatRunning: boolean

	private max_HeartbeatFailures: number

	private _awaitingResponseType: number

	private _clientSocket: UDPSocket | TCPSocket

	private _serialDriver?: SerialFT12

	private sysLogger: KNXLogger

	private _clearToSend = false

	private socketReady = false

	private timers: Map<KNXTimer, NodeJS.Timeout>

	public physAddr: KNXAddress

	public theGatewayIsKNXVirtual: boolean

	private commandQueue: Array<KNXQueueItem> = []

	private exitProcessingKNXQueueLoop: boolean

	private currentItemHandledByTheQueue: KNXQueueItem

	private queueLock = false

	private sniffingPackets: SnifferPacket[]

	private lastSnifferRequest: number

	// ==== KNX/IP Secure (migrated from SecureTunnelTCP) ====
	private _tcpRxBuffer: Buffer

	private _secureSessionKey?: Buffer

	private _secureSessionId: number = 0

	private _secureWrapperSeq: number = 0 // 6-byte counter (we store as number increment)

	private _secureTunnelSeq: number = 0 // 1-byte seq in tunneling connection header

	private _securePrivateKey?: crypto.KeyObject

	private _securePublicKey?: Buffer // 32 bytes raw X25519 public key

	private _secureUserId: number = 2

	private _secureUserPasswordKey?: Buffer

	private _secureGroupKeys: Map<number, Buffer> = new Map()

	private _secureSendSeq48: bigint = 0n

	private _secureSerial: Buffer = Buffer.from('000000000000', 'hex')

	private _secureAssignedIa: number = 0

	private _secureKeyring?: Keyring

	// Track candidate secure interface IAs for fallback selection
	private _secureCandidateIAs: string[] = []

	private _secureCandidateIndex: number = 0

	// Track hosts we have already probed with SECURE_SEARCH_REQUEST (unicast)
	private _secureSearchProbed: Set<string> = new Set()

	// ==== KNX/IP Secure Group (routing over multicast) ====
	private _secureBackboneKey?: Buffer

	private _secureRoutingTimerOffsetMs: number = 0

	private _secureRoutingTimerAuthenticated: boolean = false

	private _secureRoutingLatencyMs: number = 1000

	// Logging helpers use KNXClient loglevel; no separate boolean
	private _secureHandshakeSessionTimer?: NodeJS.Timeout

	private _secureHandshakeAuthTimer?: NodeJS.Timeout

	private _secureHandshakeConnectTimer?: NodeJS.Timeout

	// Secure routing (multicast) initial timer sync helper
	private _secureRoutingSyncTimer?: NodeJS.Timeout

	private _secureHandshakeState?:
		| 'connecting'
		| 'session'
		| 'auth'
		| 'connect'

	get udpSocket() {
		if (this._clientSocket instanceof UDPSocket) {
			return this._clientSocket
		}
		return null
	}

	get tcpSocket() {
		if (this._clientSocket instanceof TCPSocket) {
			return this._clientSocket
		}
		return null
	}

	private isSerialTransport(): boolean {
		return this._options.hostProtocol === 'SerialFT12'
	}

	constructor(
		options: KNXClientOptions,
		createSocket?: (client: KNXClient) => void,
	) {
		super()
		this.timers = new Map()
		// This is the KNX telegram's queue list
		this.commandQueue = []
		this.exitProcessingKNXQueueLoop = false

		if (options === undefined) {
			options = optionsDefaults
		} else {
			options = {
				...optionsDefaults,
				...options,
			}
		}
		this._options = options

		this.sniffingPackets = []

		this.sysLogger = createLogger(this._options.setPrefix || 'KNXEngine')
		if (this._options.loglevel) {
			setLogLevel(this._options.loglevel)
		}

		this._channelID = null
		this._connectionState = ConncetionState.DISCONNECTED
		this._numFailedTelegramACK = 0
		this._clientTunnelSeqNumber = -1
		this._options.connectionKeepAliveTimeout =
			KNX_CONSTANTS.CONNECTION_ALIVE_TIME
		this._peerHost = this._options.ipAddr
		this._peerPort = parseInt(this._options.ipPort as string, 10)
		this._options.localSocketAddress = options.localSocketAddress
		this._heartbeatFailures = 0
		this.max_HeartbeatFailures = 3
		this._awaitingResponseType = null
		this._clientSocket = null
		// Configure the limiter
		try {
			if (Number(this._options.KNXQueueSendIntervalMilliseconds) < 20) {
				this._options.KNXQueueSendIntervalMilliseconds = 20 // Protection avoiding handleKNXQueue hangs
			}
		} catch (error) {
			this._options.KNXQueueSendIntervalMilliseconds = 25
			this.sysLogger.error(
				`KNXQueueSendIntervalMilliseconds:${error.message}. Defaulting to 25`,
			)
		}

		// add an empty error listener, without this
		// every "error" emitted throws an unhandled exception
		this.on('error', (error) => {
			this.sysLogger.error(error.stack)
		})

		if (this._options.physAddr !== '') {
			this.physAddr = KNXAddress.createFromString(this._options.physAddr)
		}

		try {
			this._options.localIPAddress = ipAddressHelper.getLocalAddress(
				this._options.interface,
			)
		} catch (error) {
			this.sysLogger.error(
				`ipAddressHelper.getLocalAddress:${error.message}`,
			)
			throw error
		}

		if (createSocket) {
			createSocket(this)
		} else {
			this.createSocket()
		}
	}

	private createSocket() {
		if (this.isSerialTransport()) {
			this.socketReady = false
			return
		}
		if (this._options.hostProtocol === 'TunnelUDP') {
			this._clientSocket = dgram.createSocket({
				type: 'udp4',
				reuseAddr: true,
			}) as UDPSocket
			this.udpSocket.on(
				SocketEvents.message,
				(msg: Buffer, rinfo: RemoteInfo) => {
					try {
						// TunnelUDP never uses IP Secure wrapper; pass through
						this.processInboundMessage(msg, rinfo)
					} catch (e) {
						this.emit(
							KNXClientEvents.error,
							e instanceof Error
								? e
								: new Error('UDP data error'),
						)
					}
				},
			)
			this.udpSocket.on(SocketEvents.error, (error) => {
				this.socketReady = false
				this.emit(KNXClientEvents.error, error)
			})

			this.udpSocket.on(SocketEvents.close, () => {
				this.socketReady = false
				this.exitProcessingKNXQueueLoop = true
				// For unexpected closes, emit a disconnected event
				if (
					this._connectionState !== ConncetionState.DISCONNECTING &&
					this._connectionState !== ConncetionState.DISCONNECTED
				) {
					try {
						this.setDisconnected('Socket closed by peer').catch(
							() => {},
						)
					} catch {}
				}
				this.emit(KNXClientEvents.close)
			})

			this.udpSocket.on(SocketEvents.listening, () => {
				this.socketReady = true
				this.handleKNXQueue()
			})

			this.udpSocket.bind(
				{
					// port: this._peerPort, // Local port shall be assigned by the socket.
					address: this._options.localIPAddress, // Force UDP to be heard trough this interface
				},
				() => {
					try {
						// For multicast SEARCH_REQUEST sending, ensure correct iface and TTL
						try {
							this.udpSocket.setMulticastInterface(
								this._options.localIPAddress,
							)
							this.udpSocket.setMulticastTTL(55)
						} catch {}
						this.udpSocket.setTTL(55)
						if (this._options.localSocketAddress === undefined) {
							this._options.localSocketAddress =
								this.udpSocket.address().address
						}
					} catch (error) {
						this.sysLogger.error(
							`UDP:  Error setting SetTTL ${error.message}` || '',
						)
					}
				},
			)
		} else if (this._options.hostProtocol === 'TunnelTCP') {
			// KNX/IP Secure over TCP handled inline
			this.initTcpSocket()
		} else if (this._options.hostProtocol === 'Multicast') {
			this._clientSocket = dgram.createSocket({
				type: 'udp4',
				reuseAddr: true,
			}) as UDPSocket
			// this._clientSocket.removeAllListeners()
			this.udpSocket.on(SocketEvents.listening, () => {
				this.socketReady = true
				this.handleKNXQueue()
				// For plain multicast, emit connected at listening; for secure multicast wait for timer auth (0955/0950)
				if (
					this._connectionState === ConncetionState.CONNECTING &&
					!this._options.isSecureKNXEnabled
				) {
					this._connectionState = ConncetionState.CONNECTED
					this._numFailedTelegramACK = 0
					this.clearToSend = true
					this._clientTunnelSeqNumber = -1
					this.emit(KNXClientEvents.connected, this._options)
				}

				// If secure routing, proactively send a TimerNotify once to authenticate timer
				if (
					this._options.hostProtocol === 'Multicast' &&
					this._options.isSecureKNXEnabled
				) {
					// small delay to ensure keyring/backbone key are loaded
					try {
						clearTimeout(this._secureRoutingSyncTimer as any)
					} catch {}
					this._secureRoutingSyncTimer = setTimeout(() => {
						try {
							// Ensure backbone key available
							if (!this._secureBackboneKey)
								this.secureEnsureKeyring()
							this.secureSendTimerNotify()
						} catch {}
					}, 120)
				}
			})
			this.udpSocket.on(
				SocketEvents.message,
				(msg: Buffer, rinfo: RemoteInfo) => {
					try {
						if (this._options.isSecureKNXEnabled) {
							this.secureOnUdpData(msg, rinfo)
							return
						}
						this.processInboundMessage(msg, rinfo)
					} catch (e) {
						this.emit(
							KNXClientEvents.error,
							e instanceof Error
								? e
								: new Error('UDP data error'),
						)
					}
				},
			)
			this.udpSocket.on(SocketEvents.error, (error) => {
				this.socketReady = false
				this.emit(KNXClientEvents.error, error)
			})
			this.udpSocket.on(SocketEvents.close, () => {
				this.socketReady = false
				this.exitProcessingKNXQueueLoop = true
				if (
					this._connectionState !== ConncetionState.DISCONNECTING &&
					this._connectionState !== ConncetionState.DISCONNECTED
				) {
					try {
						this.setDisconnected('Socket closed by peer').catch(
							() => {},
						)
					} catch {}
				}
				this.emit(KNXClientEvents.close)
			})

			// The multicast traffic is not sent to a specific local IP, so we cannot set the this._options.localIPAddress in the bind
			// otherwise the socket will never ever receive a packet.
			this.udpSocket.bind(
				this._peerPort,
				this._options.theGatewayIsKNXVirtual
					? this._options.localIPAddress || '0.0.0.0'
					: '0.0.0.0',
				() => {
					try {
						this.udpSocket.setMulticastTTL(55)
						this.udpSocket.setMulticastInterface(
							this._options.localIPAddress,
						)
						// Ensure we receive our own multicast (useful for local echo/diagnostics)
						try {
							this.udpSocket.setMulticastLoopback(true)
						} catch {}
						this.sysLogger.debug(
							`[${getTimestamp()}] Multicast socket bound on ${this._options.localIPAddress || '0.0.0.0'}:${this._peerPort}`,
						)
					} catch (error) {
						this.sysLogger.error(
							`Multicast: Error setting SetTTL ${error.message}` ||
								'',
						)
					}
					try {
						this.udpSocket.addMembership(
							this._peerHost,
							this._options.localIPAddress,
						)
						this.sysLogger.debug(
							`[${getTimestamp()}] Joined multicast group ${this._peerHost} on ${this._options.localIPAddress}`,
						)
					} catch (err) {
						this.sysLogger.error(
							'Multicast: cannot add membership (%s)',
							err,
						)
						this.emit(KNXClientEvents.error, err)
					}
				},
			)
		}
	}

	// Initialize/Reinitialize TCP socket and its listeners for KNX/IP Secure over TCP
	private initTcpSocket() {
		this._clientSocket = new net.Socket()
		// Buffer incoming TCP to complete frames
		this._tcpRxBuffer = Buffer.alloc(0)

		this.tcpSocket.on('connect', () => {
			// TCP connected, start secure session handshake
			this.socketReady = true
			// Reset queue exit flag on fresh TCP connect
			this.exitProcessingKNXQueueLoop = false
			this.secureStartSession().catch((err) => {
				this.emit(KNXClientEvents.error, err)
			})
		})
		this.tcpSocket.on('data', (data: Buffer) => {
			try {
				this.secureOnTcpData(data)
			} catch (e) {
				this.emit(
					KNXClientEvents.error,
					e instanceof Error ? e : new Error('TCP data error'),
				)
			}
		})
		this.tcpSocket.on('error', (error) => {
			this.socketReady = false
			this.emit(KNXClientEvents.error, error)
		})
		this.tcpSocket.on('close', () => {
			this.socketReady = false
			this.exitProcessingKNXQueueLoop = true
			try {
				this.sysLogger.debug(
					`[${getTimestamp()}] TCP close: set exitProcessingKNXQueueLoop=true`,
				)
			} catch {}
			// If the socket closed unexpectedly, propagate a disconnected event
			if (
				this._connectionState !== ConncetionState.DISCONNECTING &&
				this._connectionState !== ConncetionState.DISCONNECTED
			) {
				try {
					this.setDisconnected('Socket closed by peer').catch(
						() => {},
					)
				} catch {}
			}
			this.emit(KNXClientEvents.close)
		})
	}

	private async connectSerialTransport() {
		const options: SerialFT12Options = {
			...(this._options.serialInterface || {}),
		}
		this._peerHost = options.path || '/dev/ttyAMA0'
		this._peerPort = 0

		// Prepare KNX Data Secure for serial mode (KBerry):
		// if a .knxkeys file is configured, load group keys so that
		// maybeApplyDataSecure / maybeDecryptDataSecure can work on cEMI frames.
		if (this._options.isSecureKNXEnabled) {
			try {
				await this.secureEnsureKeyring()
			} catch (err) {
				try {
					this.sysLogger.error(
						`[${getTimestamp()}] Serial FT1.2: secure keyring error: ${(err as Error).message}`,
					)
				} catch {}
			}
		}

		this._serialDriver = new SerialFT12(options)
		this._serialDriver.on('cemi', (payload) =>
			this.handleSerialCemi(payload),
		)
		this._serialDriver.on('error', (err) => {
			this.emit(
				KNXClientEvents.error,
				err instanceof Error ? err : new Error(String(err)),
			)
		})
		this._serialDriver.on('close', () => {
			if (this.isSerialTransport()) {
				this.socketReady = false
				if (
					this._connectionState !== ConncetionState.DISCONNECTED &&
					this._connectionState !== ConncetionState.DISCONNECTING
				) {
					this.setDisconnected('Serial FT1.2 port closed').catch(
						() => {},
					)
				}
			}
		})
		await this._serialDriver.open()
	}

	private async closeSerialTransport() {
		if (!this._serialDriver) return
		try {
			await this._serialDriver.close()
		} catch (error) {
			this.sysLogger.warn(
				`[${getTimestamp()}] Serial FT1.2 close error: ${(error as Error).message}`,
			)
		} finally {
			this._serialDriver = undefined
			this.socketReady = false
		}
	}

	private handleSerialCemi(payload: Buffer) {
		try {
			if (!payload || payload.length < 2) return
			const msgCode = payload.readUInt8(0)
			// eslint-disable-next-line default-case
			switch (msgCode) {
				case CEMIConstants.L_DATA_IND: {
					const cemi = CEMIFactory.createFromBuffer(
						msgCode,
						payload,
						1,
					)
					this.ensurePlainCEMI(cemi)
					this.emit(
						KNXClientEvents.indication,
						new KNXRoutingIndication(cemi),
						false,
					)
					break
				}
				case CEMIConstants.L_DATA_CON: {
					break
				}
			}
		} catch (error) {
			this.sysLogger.error(
				`[${getTimestamp()}] Serial FT1.2 parse error: ${
					(error as Error).message
				}`,
			)
		}
	}

	private extractCemiMessage(packet: KNXPacket): CEMIMessage {
		const cemi = (packet as any)?.cEMIMessage
		if (!cemi) {
			throw new Error('KNX packet does not contain a cEMI message')
		}
		return cemi
	}

	/**
	 * The channel ID of the connection. Only defined after a successful connection
	 */
	get channelID() {
		return this._channelID
	}

	/**
	 * Handle the busy state, for example while waiting for ACK. When true means we can send new telegrams to bus
	 */
	get clearToSend(): boolean {
		return this._clearToSend
	}

	set clearToSend(val: boolean) {
		this._clearToSend = val
		if (val) {
			this.handleKNXQueue()
		}
	}

	private getKNXDataBuffer(data: Buffer, dptid: string | number) {
		if (typeof dptid === 'number') {
			dptid = dptid.toString()
		}

		const adpu = {} as DPTLib.APDU
		DPTLib.populateAPDU(data, adpu, dptid)
		const iDatapointType: number = parseInt(
			dptid.substring(0, dptid.indexOf('.')),
		)
		const isSixBits: boolean = adpu.bitlength <= 6

		this.sysLogger.debug(
			`[${getTimestamp()}] ` +
				`isSixBits:${isSixBits} Includes (should be = isSixBits):${[
					1, 2, 3, 5, 9, 10, 11, 14, 18,
				].includes(iDatapointType)} ADPU BitLength:${adpu.bitlength}`,
		)

		const datapoint: IDataPoint = {
			id: '',
			value: 'any',
			type: { type: isSixBits },
			bind: null,
			read: () => null,
			write: null,
		}

		return new KNXDataBuffer(adpu.data, datapoint)
	}

	/** Waits till providden event occurs for at most the providden timeout */
	private async waitForEvent(event: KNXClientEvents, timeout: number) {
		let resolveRef: () => void
		return Promise.race<void>([
			new Promise<void>((resolve) => {
				resolveRef = resolve
				this.once(event, resolve)
			}),
			wait(timeout),
		]).then(() => {
			this.off(event, resolveRef)
		})
	}

	private setTimer(type: KNXTimer, cb: () => void, delay: number) {
		if (this.timers.has(type)) {
			clearTimeout(this.timers.get(type))
			this.timers.delete(type)
			// TODO: should we throw error?
			this.sysLogger.warn(`Timer "${type}" was already running`)
		}

		this.timers.set(
			type,
			setTimeout(() => {
				this.timers.delete(type)
				cb()
			}, delay),
		)
	}

	private clearTimer(type: KNXTimer) {
		if (this.timers.has(type)) {
			clearTimeout(this.timers.get(type))
			this.timers.delete(type)
		}
	}

	private clearAllTimers() {
		// use dedicated methods where possible
		this.stopDiscovery()
		this.stopHeartBeat()
		this.stopGatewayDescription()
		// clear all other timers
		for (const timer of this.timers.keys()) {
			this.clearTimer(timer)
		}
	}

	private processKnxPacketQueueItem(_knxPacket: KNXPacket): Promise<boolean> {
		return new Promise((resolve) => {
			// Prepare the debug log ************************
			if (this.sysLogger.level === 'debug') {
				if (
					_knxPacket instanceof KNXTunnelingRequest ||
					_knxPacket instanceof KNXRoutingIndication
				) {
					// Composing debug string
					let sTPCI = ''
					if (_knxPacket.cEMIMessage.npdu.isGroupRead) {
						sTPCI = 'Read'
					}
					if (_knxPacket.cEMIMessage.npdu.isGroupResponse) {
						sTPCI = 'Response'
					}
					if (_knxPacket.cEMIMessage.npdu.isGroupWrite) {
						sTPCI = 'Write'
					}
					let sDebugString = ''
					sDebugString = `peerHost:${this._peerHost}:${this._peerPort}`
					sDebugString += ` dstAddress: ${_knxPacket.cEMIMessage.dstAddress.toString()}`
					sDebugString += ` channelID:${this._channelID === null || this._channelID === undefined ? 'None' : this._channelID}`
					sDebugString += ` npdu: ${sTPCI}`
					sDebugString += ` knxHeader: ${_knxPacket.constructor.name}`
					sDebugString += ` raw: ${JSON.stringify(_knxPacket)}`
					this.sysLogger.debug(
						`[${getTimestamp()}] ` +
							`KNXEngine: <outgoing telegram>: ${sDebugString} `,
					)
				} else if (_knxPacket instanceof KNXTunnelingAck) {
					this.sysLogger.debug(
						`[${getTimestamp()}] ` +
							`KNXEngine: <outgoing telegram ACK>:${this.getKNXConstantName(_knxPacket.status)} channelID:${_knxPacket.channelID} seqCounter:${_knxPacket.seqCounter}`,
					)
				}
			}
			// End Prepare the debug log ************************
			if (this.isSerialTransport()) {
				try {
					const cemi = this.extractCemiMessage(_knxPacket)
					if (
						this._options.isSecureKNXEnabled &&
						_knxPacket instanceof KNXRoutingIndication
					) {
						this.maybeApplyDataSecure(cemi as any)
						try {
							_knxPacket.length = cemi.length ?? _knxPacket.length
						} catch {}
					}
					this._serialDriver
						?.sendCemiPayload(cemi.toBuffer())
						.then(() => resolve(true))
						.catch((error) => {
							this.emit(
								KNXClientEvents.error,
								error instanceof Error
									? error
									: new Error(String(error)),
							)
							resolve(false)
						})
				} catch (error) {
					this.emit(
						KNXClientEvents.error,
						error instanceof Error
							? error
							: new Error(String(error)),
					)
					resolve(false)
				}
				return
			}

			if (
				this._options.hostProtocol === 'Multicast' ||
				this._options.hostProtocol === 'TunnelUDP'
			) {
				try {
					// If Multicast+Secure, apply Data Secure (if GA has key) before wrapping
					try {
						if (
							this._options.hostProtocol === 'Multicast' &&
							this._options.isSecureKNXEnabled &&
							_knxPacket instanceof KNXRoutingIndication
						) {
							const kri = _knxPacket as KNXRoutingIndication & {
								header: any
								length: number
							}
							this.maybeApplyDataSecure(kri.cEMIMessage as any)
							// Update KNX/IP header length to include updated cEMI length
							try {
								kri.length =
									kri.cEMIMessage?.length ?? kri.length
								kri.header.length =
									KNX_CONSTANTS.HEADER_SIZE_10 + kri.length
							} catch {}
						}
					} catch {}

					let outBuf = _knxPacket.toBuffer()
					if (
						this._options.hostProtocol === 'Multicast' &&
						this._options.isSecureKNXEnabled &&
						(_knxPacket instanceof KNXRoutingIndication ||
							(_knxPacket as any)?.header?.service_type ===
								KNX_CONSTANTS.ROUTING_INDICATION)
					) {
						try {
							outBuf = this.secureWrapRouting(outBuf)
							if (this.isLevelEnabled('debug')) {
								this.sysLogger.debug(
									`[${getTimestamp()}] TX 0950 SecureWrapper (routing) len=${outBuf.length}`,
								)
							}
						} catch (e) {
							this.sysLogger.error(
								`Secure multicast wrap error: ${(e as Error).message}`,
							)
						}
					}

					this.udpSocket.send(
						outBuf,
						this._peerPort,
						this._peerHost,
						(error) => {
							if (error) {
								this.sysLogger.error(
									`Sending KNX packet: Send UDP sending error: ${error.message}`,
								)
								this.emit(KNXClientEvents.error, error)
							}

							resolve(!error)
						},
					)
				} catch (error) {
					this.sysLogger.error(
						`Sending KNX packet: Send UDP Catch error: ${
							(error as Error).message
						} ${typeof _knxPacket} seqCounter:${
							(_knxPacket as any)?.seqCounter
						}`,
					)
					this.emit(KNXClientEvents.error, error as Error)
					resolve(false)
				}
			} else if (this._options.hostProtocol === 'TunnelTCP') {
				// KNX Secure over TCP: wrap KNX/IP frame in SecureWrapper and send via TCP
				try {
					// Ensure Data Secure is applied at send time (after leaving the queue)
					if (
						this._options.isSecureKNXEnabled &&
						_knxPacket instanceof KNXTunnelingRequest &&
						(_knxPacket as any).cEMIMessage?.msgCode ===
							CEMIConstants.L_DATA_REQ
					) {
						// Apply Data Secure right before sending
						this.maybeApplyDataSecure(
							(_knxPacket as any).cEMIMessage,
						)
						// IMPORTANT: update KNX/IP header length to include new cEMI length
						try {
							const ktr = _knxPacket as KNXTunnelingRequest
							const cemiLen = ktr.cEMIMessage?.length ?? 0
							// Header.length includes header size (10) + body length
							ktr.header.length =
								KNX_CONSTANTS.HEADER_SIZE_10 + (4 + cemiLen)
						} catch {}
					}

					// Debug before wrapping: show if APDU is secure/plain, GA, src, flags and seq48
					try {
						if (_knxPacket instanceof KNXTunnelingRequest) {
							const ktr: any = _knxPacket
							const cemi: any = ktr?.cEMIMessage
							const dstStr = cemi?.dstAddress?.toString?.()
							const srcStr = cemi?.srcAddress?.toString?.()
							const ctrlBuf: Buffer = cemi?.control?.toBuffer?.()
							const flags16 = Buffer.isBuffer(ctrlBuf)
								? (ctrlBuf[0] << 8) | ctrlBuf[1]
								: undefined
							const isSecApdu = !!(
								cemi?.npdu &&
								(cemi.npdu.tpci & 0xff) === APCI_SEC.HIGH &&
								(cemi.npdu.apci & 0xff) === APCI_SEC.LOW
							)
							let scf: number | undefined
							let seq48Hex: string | undefined
							if (isSecApdu) {
								const dbuf: Buffer = cemi.npdu.dataBuffer?.value
								if (
									Buffer.isBuffer(dbuf) &&
									dbuf.length >= 1 + SECURE_SEQ_LEN
								) {
									scf = dbuf[0]
									const seq = dbuf.subarray(
										1,
										1 + SECURE_SEQ_LEN,
									)
									seq48Hex = seq.toString('hex')
								}
							}
							this.sysLogger.debug(
								`[${getTimestamp()}] ` +
									`TX TunnelTCP: dst=${dstStr} src=${srcStr} flags=0x${(
										flags16 ?? 0
									).toString(
										16,
									)} dataSecure=${isSecApdu} scf=${
										typeof scf === 'number' ? scf : 'n/a'
									} seq48=${seq48Hex ?? 'n/a'}`,
							)
							try {
								if (this.isLevelEnabled('debug')) {
									const innerHex = ktr
										.toBuffer()
										.toString('hex')
									this.sysLogger.debug(
										`[${getTimestamp()}] TX inner (KNX/IP TunnelReq): ${innerHex}`,
									)
								}
							} catch {}
						}
					} catch {}

					const inner = _knxPacket.toBuffer()
					const payload = this._options.isSecureKNXEnabled
						? this.secureWrap(inner)
						: inner
					this.tcpSocket.write(payload, (error) => {
						if (error) {
							this.sysLogger.error(
								`Sending KNX packet: Send TCP sending error: ${error.message}` ||
									'Undef error',
							)
							this.emit(KNXClientEvents.error, error)
						}
						resolve(!error)
					})
				} catch (error) {
					this.sysLogger.error(
						`Sending KNX packet: Send TCP Catch error: ${(error as Error).message}` ||
							'Undef error',
					)
					this.emit(KNXClientEvents.error, error as Error)
					resolve(false)
				}
			}
		})
	}

	private async handleKNXQueue() {
		if (this.queueLock) {
			this.sysLogger.debug(
				`[${getTimestamp()}] ` +
					`KNXClient: handleKNXQueue: HandleQueue has called, but the queue loop is already running. Exit.`,
			)
			return
		}

		this.sysLogger.debug(
			`[${getTimestamp()}] ` +
				`KNXClient: handleKNXQueue: Start Processing queued KNX. Found ${this.commandQueue.length} telegrams in queue.`,
		)

		// lock the queue
		this.queueLock = true

		// Limiter: limits max telegrams per second
		while (this.commandQueue.length > 0) {
			if (!this.clearToSend) {
				this.sysLogger.debug(
					`[${getTimestamp()}] ` +
						`KNXClient: handleKNXQueue: Clear to send is false. Pause processing queue.`,
				)
				break
			}

			if (this.exitProcessingKNXQueueLoop) {
				this.sysLogger.debug(
					`[${getTimestamp()}] ` +
						`KNXClient: handleKNXQueue: exitProcessingKNXQueueLoop is true. Exit processing queue loop`,
				)
				break
			}

			if (this.socketReady === false) {
				this.sysLogger.debug(
					`[${getTimestamp()}] ` +
						`KNXClient: handleKNXQueue: Socket is not ready. Stop processing queue.`,
				)
				break
			}

			const item = this.commandQueue.pop()

			// Secure multicast gating: wait for timer authentication before sending RoutingIndication
			if (
				this._options.hostProtocol === 'Multicast' &&
				this._options.isSecureKNXEnabled &&
				(this._options.secureRoutingWaitForTimer ?? true) &&
				!this._secureRoutingTimerAuthenticated &&
				item.knxPacket instanceof KNXRoutingIndication
			) {
				try {
					this.sysLogger.debug(
						`[${getTimestamp()}] Secure multicast: waiting timer auth, deferring 0950 send`,
					)
				} catch {}
				// push back item and wait briefly
				this.commandQueue.push(item)
				await wait(200)
				continue
			}
			this.currentItemHandledByTheQueue = item
			// Associa il sequence number di tunneling al momento dell'invio
			try {
				if (this._options.hostProtocol === 'TunnelTCP') {
					// Solo per KNXTunnelingRequest: il seq dell'ACK deve eguagliare quello ricevuto, non va incrementato
					if (item.knxPacket instanceof KNXTunnelingRequest) {
						const ktr = item.knxPacket as any
						const seq = this.secureIncTunnelSeq()
						ktr.seqCounter = seq
						if (item.ACK) {
							item.expectedSeqNumberForACK = seq
						}
						try {
							this.sysLogger.debug(
								`[${getTimestamp()}] Assign tunnel seq=${seq} ch=${ktr?.channelID} dst=${ktr?.cEMIMessage?.dstAddress?.toString?.()}`,
							)
						} catch {}
					}
				}
			} catch {}

			if (
				item.ACK !== undefined &&
				this._options.hostProtocol !== 'TunnelTCP'
			) {
				this.setTimerWaitingForACK(item.ACK)
			}

			if (!(await this.processKnxPacketQueueItem(item.knxPacket))) {
				this.sysLogger.error(
					`KNXClient: handleKNXQueue: returning from processKnxPacketQueueItem ${JSON.stringify(item)}`,
				)
				// Clear the queue
				this.commandQueue = []
				break
			}

			await wait(this._options.KNXQueueSendIntervalMilliseconds)
		}

		this.queueLock = false

		this.sysLogger.debug(
			`[${getTimestamp()}] ` +
				`KNXClient: handleKNXQueue: End Processing queued KNX.`,
		)
	}

	/**
	 * Write knxPacket to socket
	 */
	send(
		_knxPacket: KNXPacket,
		_ACK: KNXTunnelingRequest,
		_priority: boolean,
		_expectedSeqNumberForACK: number,
	): void {
		const toBeAdded: KNXQueueItem = {
			knxPacket: _knxPacket,
			ACK: _ACK,
			expectedSeqNumberForACK: _expectedSeqNumberForACK,
		}

		if (this._options.sniffingMode) {
			const buffer = _knxPacket.toBuffer()
			this.sniffingPackets.push({
				reqType: _knxPacket.constructor.name,
				request: buffer.toString('hex'),
				deltaReq: this.lastSnifferRequest
					? Date.now() - this.lastSnifferRequest
					: 0,
			})

			this.lastSnifferRequest = Date.now()
		}

		if (_priority) {
			this.commandQueue.push(toBeAdded) // Put the item as first to be sent.
			this.clearToSend = true
		} else {
			this.commandQueue.unshift(toBeAdded) // Put the item as last to be sent.
		}

		this.handleKNXQueue()

		this.sysLogger.debug(
			`[${getTimestamp()}] ` +
				`KNXClient: <added telegram to queue> queueLength:${this.commandQueue.length} priority:${_priority} type:${this.getKNXConstantName(toBeAdded.knxPacket.type)} channelID:${toBeAdded.ACK?.channelID || 'filled later'} seqCounter:${toBeAdded.ACK?.seqCounter || 'filled later'}`,
		)
	}

	/** Sends a WRITE telegram to the BUS.
	 * `dstAddress` is the group address (for example "0/0/1"),
	 * `data` is the value you want to send (for example true),
	 * `dptid` is a string/number representing the datapoint (for example "5.001")
	 */
	write(
		dstAddress: KNXAddress | string,
		data: any,
		dptid: string | number,
	): void {
		if (this._connectionState !== ConncetionState.CONNECTED)
			throw new Error(
				'The socket is not connected. Unable to access the KNX BUS',
			)

		// Get the Data Buffer from the plain value
		const knxBuffer = this.getKNXDataBuffer(data, dptid)

		if (typeof dstAddress === 'string')
			dstAddress = KNXAddress.createFromString(
				dstAddress,
				KNXAddress.TYPE_GROUP,
			)
		const srcAddress = this.physAddr

		if (this._options.hostProtocol === 'Multicast') {
			// Multicast: per KNX Routing spec, inject as L_DATA_IND
			const cEMIMessage = CEMIFactory.newLDataIndicationMessage(
				'write',
				srcAddress,
				dstAddress,
				knxBuffer,
			)
			cEMIMessage.control.ack = 0
			cEMIMessage.control.broadcast = 1
			cEMIMessage.control.priority = 3
			cEMIMessage.control.addressType = 1
			cEMIMessage.control.hopCount = 6
			const knxPacketRequest =
				KNXProtocol.newKNXRoutingIndication(cEMIMessage)
			this.send(knxPacketRequest, undefined, false, this.getSeqNumber())
			// 06/12/2021 Multicast automatically echoes telegrams
		} else if (this.isSerialTransport()) {
			// Serial FT1.2 (KBerry): send as L_DATA_REQ over cEMI/FT1.2
			const cEMIMessage = CEMIFactory.newLDataRequestMessage(
				'write',
				srcAddress,
				dstAddress,
				knxBuffer,
			)
			// Request bus ACK unless suppressed
			cEMIMessage.control.ack = this._options.suppress_ack_ldatareq
				? 0
				: 1
			cEMIMessage.control.broadcast = 1
			cEMIMessage.control.priority = 3
			cEMIMessage.control.addressType = 1
			cEMIMessage.control.hopCount = 6
			const knxPacketRequest =
				KNXProtocol.newKNXRoutingIndication(cEMIMessage)
			this.send(knxPacketRequest, undefined, false, this.getSeqNumber())
			// Echo on local client as indication
			this.ensurePlainCEMI(cEMIMessage)
			this.emit(KNXClientEvents.indication, knxPacketRequest as any, true)
		} else {
			// Tunneling
			const cEMIMessage = CEMIFactory.newLDataRequestMessage(
				'write',
				srcAddress,
				dstAddress,
				knxBuffer,
			)
			// Tunnelling UDP: request bus ACK unless suppressed; TunnelTCP: no bus ACK
			cEMIMessage.control.ack =
				// eslint-disable-next-line no-nested-ternary
				this._options.hostProtocol === 'TunnelTCP'
					? 0
					: this._options.suppress_ack_ldatareq
						? 0
						: 1
			cEMIMessage.control.broadcast = 1
			cEMIMessage.control.priority = 3
			cEMIMessage.control.addressType = 1
			cEMIMessage.control.hopCount = 6
			// Data Secure si applica solo in TunnelTCP
			// Nota: per TunnelTCP, il seq di tunneling viene assegnato al momento dell'invio in handleKNXQueue
			const seqNum: number =
				this._options.hostProtocol === 'TunnelTCP'
					? 0
					: this.incSeqNumber()
			const knxPacketRequest = KNXProtocol.newKNXTunnelingRequest(
				this._channelID,
				seqNum,
				cEMIMessage,
			)
			if (!this._options.suppress_ack_ldatareq) {
				this.send(knxPacketRequest, knxPacketRequest, false, seqNum)
			} else {
				this.send(knxPacketRequest, undefined, false, seqNum)
			}
			// 06/12/2021 Echo the sent telegram. Emit entire telegram with plain cEMI
			this.ensurePlainCEMI(knxPacketRequest.cEMIMessage)
			this.emit(KNXClientEvents.indication, knxPacketRequest as any, true)
		}
	}

	/**
	 * Sends a RESPONSE telegram to the BUS.
	 * `dstAddress` is the group address (for example "0/0/1"),
	 * `data` is the value you want to send (for example true),
	 * `dptid` is a string/number representing the datapoint (for example "5.001")
	 */
	respond(
		dstAddress: KNXAddress | string,
		data: Buffer,
		dptid: string | number,
	): void {
		if (this._connectionState !== ConncetionState.CONNECTED)
			throw new Error(
				'The socket is not connected. Unable to access the KNX BUS',
			)

		// Get the Data Buffer from the plain value
		const knxBuffer = this.getKNXDataBuffer(data, dptid)

		if (typeof dstAddress === 'string')
			dstAddress = KNXAddress.createFromString(
				dstAddress,
				KNXAddress.TYPE_GROUP,
			)
		const srcAddress = this.physAddr

		if (this._options.hostProtocol === 'Multicast') {
			// Multicast: per KNX Routing spec, inject as L_DATA_IND
			const cEMIMessage = CEMIFactory.newLDataIndicationMessage(
				'response',
				srcAddress,
				dstAddress,
				knxBuffer,
			)
			cEMIMessage.control.ack = 0 // No ack like telegram sent from ETS (0 means don't care)
			cEMIMessage.control.broadcast = 1
			cEMIMessage.control.priority = 3
			cEMIMessage.control.addressType = 1
			cEMIMessage.control.hopCount = 6
			const knxPacketRequest =
				KNXProtocol.newKNXRoutingIndication(cEMIMessage)
			this.send(knxPacketRequest, undefined, false, this.getSeqNumber())
			// 06/12/2021 Multicast automatically echoes telegrams
		} else if (this.isSerialTransport()) {
			// Serial FT1.2 (KBerry): send as L_DATA_REQ over cEMI/FT1.2
			const cEMIMessage = CEMIFactory.newLDataRequestMessage(
				'response',
				srcAddress,
				dstAddress,
				knxBuffer,
			)
			// No ACK request on bus for responses
			cEMIMessage.control.ack = 0
			cEMIMessage.control.broadcast = 1
			cEMIMessage.control.priority = 3
			cEMIMessage.control.addressType = 1
			cEMIMessage.control.hopCount = 6
			const knxPacketRequest =
				KNXProtocol.newKNXRoutingIndication(cEMIMessage)
			this.send(knxPacketRequest, undefined, false, this.getSeqNumber())
			this.ensurePlainCEMI(cEMIMessage)
			this.emit(KNXClientEvents.indication, knxPacketRequest as any, true)
		} else {
			// Tunneling
			const cEMIMessage = CEMIFactory.newLDataRequestMessage(
				'response',
				srcAddress,
				dstAddress,
				knxBuffer,
			)
			// No ACK request on bus
			cEMIMessage.control.ack = 0
			cEMIMessage.control.broadcast = 1
			cEMIMessage.control.priority = 3
			cEMIMessage.control.addressType = 1
			cEMIMessage.control.hopCount = 6
			// Data Secure si applica solo in TunnelTCP
			const seqNum: number =
				this._options.hostProtocol === 'TunnelTCP'
					? 0
					: this.incSeqNumber()
			const knxPacketRequest = KNXProtocol.newKNXTunnelingRequest(
				this._channelID,
				seqNum,
				cEMIMessage,
			)
			if (!this._options.suppress_ack_ldatareq) {
				this.send(knxPacketRequest, knxPacketRequest, false, seqNum)
			} else {
				this.send(knxPacketRequest, undefined, false, seqNum)
			}
			// 06/12/2021 Echo the sent telegram. Emit entire telegram with plain cEMI
			this.ensurePlainCEMI(knxPacketRequest.cEMIMessage)
			this.emit(KNXClientEvents.indication, knxPacketRequest as any, true)
		}
	}

	/**
	 * Sends a READ telegram to the BUS. GA is the group address (for example "0/0/1").
	 */
	read(dstAddress: KNXAddress | string): void {
		if (this._connectionState !== ConncetionState.CONNECTED)
			throw new Error(
				'The socket is not connected. Unable to access the KNX BUS',
			)

		if (typeof dstAddress === 'string')
			dstAddress = KNXAddress.createFromString(
				dstAddress,
				KNXAddress.TYPE_GROUP,
			)
		const srcAddress = this.physAddr

		if (this._options.hostProtocol === 'Multicast') {
			// Multicast: per KNX Routing spec, inject as L_DATA_IND
			const cEMIMessage = CEMIFactory.newLDataIndicationMessage(
				'read',
				srcAddress,
				dstAddress,
				null,
			)
			cEMIMessage.control.ack = 0
			cEMIMessage.control.broadcast = 1
			cEMIMessage.control.priority = 3
			cEMIMessage.control.addressType = 1
			cEMIMessage.control.hopCount = 6
			const knxPacketRequest =
				KNXProtocol.newKNXRoutingIndication(cEMIMessage)
			this.send(knxPacketRequest, undefined, false, this.getSeqNumber())
			// 06/12/2021 Multicast automatically echoes telegrams
		} else if (this.isSerialTransport()) {
			// Serial FT1.2 (KBerry): send as L_DATA_REQ over cEMI/FT1.2
			const cEMIMessage = CEMIFactory.newLDataRequestMessage(
				'read',
				srcAddress,
				dstAddress,
				null,
			)
			// Request bus ACK unless suppressed
			cEMIMessage.control.ack = this._options.suppress_ack_ldatareq
				? 0
				: 1
			cEMIMessage.control.broadcast = 1
			cEMIMessage.control.priority = 3
			cEMIMessage.control.addressType = 1
			cEMIMessage.control.hopCount = 6
			const knxPacketRequest =
				KNXProtocol.newKNXRoutingIndication(cEMIMessage)
			this.send(knxPacketRequest, undefined, false, this.getSeqNumber())
			this.ensurePlainCEMI(cEMIMessage)
			this.emit(KNXClientEvents.indication, knxPacketRequest as any, true)
		} else {
			// Tunneling
			const cEMIMessage = CEMIFactory.newLDataRequestMessage(
				'read',
				srcAddress,
				dstAddress,
				null,
			)
			// Tunnelling UDP: request bus ACK unless suppressed; TunnelTCP: no bus ACK
			cEMIMessage.control.ack =
				// eslint-disable-next-line no-nested-ternary
				this._options.hostProtocol === 'TunnelTCP'
					? 0
					: this._options.suppress_ack_ldatareq
						? 0
						: 1
			cEMIMessage.control.broadcast = 1
			cEMIMessage.control.priority = 3
			cEMIMessage.control.addressType = 1
			cEMIMessage.control.hopCount = 6
			const seqNum: number =
				this._options.hostProtocol === 'TunnelTCP'
					? 0
					: this.incSeqNumber()
			const knxPacketRequest = KNXProtocol.newKNXTunnelingRequest(
				this._channelID,
				seqNum,
				cEMIMessage,
			)
			if (!this._options.suppress_ack_ldatareq) {
				this.send(knxPacketRequest, knxPacketRequest, false, seqNum)
			} else {
				this.send(knxPacketRequest, undefined, false, seqNum)
			}
			// 06/12/2021 Echo the sent telegram. Emit entire telegram with plain cEMI
			this.ensurePlainCEMI(knxPacketRequest.cEMIMessage)
			this.emit(KNXClientEvents.indication, knxPacketRequest as any, true)
		}
	}

	/**
	 * Sends a WRITE telegram to the BUS.
	 * `dstAddress` is the group address (for example "0/0/1"),
	 * `rawDataBuffer` is the buffer you want to send,
	 * `dptid` is a string/number representing the datapoint (for example "5.001")
	 */
	writeRaw(
		dstAddress: KNXAddress | string,
		rawDataBuffer: Buffer,
		bitlength: number,
	): void {
		// bitlength is unused and only for backward compatibility

		if (this._connectionState !== ConncetionState.CONNECTED)
			throw new Error(
				'The socket is not connected. Unable to access the KNX BUS',
			)

		if (!Buffer.isBuffer(rawDataBuffer)) {
			this.sysLogger.error(
				'KNXClient: writeRaw: Value must be a buffer! ',
			)
			return
		}

		const isSixBits: boolean = bitlength <= 6
		const datapoint: IDataPoint = {
			id: '',
			value: 'any',
			type: { type: isSixBits },
			bind: null,
			read: () => null,
			write: null,
		}
		// Get the KNDDataBuffer
		const baseBufferFromBitLength: Buffer = Buffer.alloc(
			Math.ceil(bitlength / 8),
		) // The buffer length must be like specified by bitlength
		rawDataBuffer.copy(baseBufferFromBitLength, 0)
		const data: KNXDataBuffer = new KNXDataBuffer(
			baseBufferFromBitLength,
			datapoint,
		)

		if (typeof dstAddress === 'string')
			dstAddress = KNXAddress.createFromString(
				dstAddress,
				KNXAddress.TYPE_GROUP,
			)
		const srcAddress = this.physAddr
		if (this._options.hostProtocol === 'Multicast') {
			// Multicast: per KNX Routing spec, inject as L_DATA_IND
			const cEMIMessage = CEMIFactory.newLDataIndicationMessage(
				'write',
				srcAddress,
				dstAddress,
				data,
			)
			cEMIMessage.control.ack = 0
			cEMIMessage.control.broadcast = 1
			cEMIMessage.control.priority = 3
			cEMIMessage.control.addressType = 1
			cEMIMessage.control.hopCount = 6
			const knxPacketRequest =
				KNXProtocol.newKNXRoutingIndication(cEMIMessage)
			this.send(knxPacketRequest, undefined, false, this.getSeqNumber())
			// 06/12/2021 Multicast automatically echoes telegrams
		} else if (this.isSerialTransport()) {
			// Serial FT1.2 (KBerry): send as L_DATA_REQ over cEMI/FT1.2
			const cEMIMessage = CEMIFactory.newLDataRequestMessage(
				'write',
				srcAddress,
				dstAddress,
				data,
			)
			// Request bus ACK unless suppressed (TunnelTCP rules don't apply here)
			cEMIMessage.control.ack = this._options.suppress_ack_ldatareq
				? 0
				: 1
			cEMIMessage.control.broadcast = 1
			cEMIMessage.control.priority = 3
			cEMIMessage.control.addressType = 1
			cEMIMessage.control.hopCount = 6
			const knxPacketRequest =
				KNXProtocol.newKNXRoutingIndication(cEMIMessage)
			this.send(knxPacketRequest, undefined, false, this.getSeqNumber())
			this.ensurePlainCEMI(cEMIMessage)
			this.emit(KNXClientEvents.indication, knxPacketRequest as any, true)
		} else {
			// Tunneling
			const cEMIMessage = CEMIFactory.newLDataRequestMessage(
				'write',
				srcAddress,
				dstAddress,
				data,
			)
			// ACK handling:
			// - TunnelTCP (secure): do not request bus ACK (align ETS/sample)
			// - TunnelUDP (plain): keep legacy behavior controlled by suppress_ack_ldatareq
			if (this._options.hostProtocol === 'TunnelTCP') {
				cEMIMessage.control.ack = 0
			} else {
				cEMIMessage.control.ack = this._options.suppress_ack_ldatareq
					? 0
					: 1
			}
			cEMIMessage.control.broadcast = 1
			cEMIMessage.control.priority = 3
			cEMIMessage.control.addressType = 1
			cEMIMessage.control.hopCount = 6
			const seqNum: number =
				this._options.hostProtocol === 'TunnelTCP'
					? this.secureIncTunnelSeq()
					: this.incSeqNumber()
			const knxPacketRequest = KNXProtocol.newKNXTunnelingRequest(
				this._channelID,
				seqNum,
				cEMIMessage,
			)
			if (!this._options.suppress_ack_ldatareq) {
				this.send(knxPacketRequest, knxPacketRequest, false, seqNum)
			} else {
				this.send(knxPacketRequest, undefined, false, seqNum)
			}
			// 06/12/2021 Echo the sent telegram. Emit entire telegram with plain cEMI
			this.ensurePlainCEMI(knxPacketRequest.cEMIMessage)
			this.emit(KNXClientEvents.indication, knxPacketRequest as any, true)
		}
	}

	private startHeartBeat(): void {
		this.stopHeartBeat()
		this._heartbeatFailures = 0
		this._heartbeatRunning = true
		this.runHeartbeat()
	}

	private stopHeartBeat(): void {
		this._heartbeatRunning = false
		this.clearTimer(KNXTimer.HEARTBEAT)
		this.clearTimer(KNXTimer.CONNECTION_STATE)
	}

	/**
	 * Returns true if discovery is running
	 */
	isDiscoveryRunning() {
		return this.timers.has(KNXTimer.DISCOVERY)
	}

	/**
	 * Send a search request message to the KNX bus and wait for responses
	 * Set _clearToSend to true to allow the discovery packet to process. Initially set to false to prevent premature sends!
	 */
	startDiscovery() {
		this._clearToSend = true
		if (this.isDiscoveryRunning()) {
			throw new Error('Discovery already running')
		}
		this.setTimer(
			KNXTimer.DISCOVERY,
			() => {},
			1000 * KNX_CONSTANTS.SEARCH_TIMEOUT,
		)
		// Send bursts to increase chances across stacks/NICs
		this.sendSearchRequestMessage()
		setTimeout(() => {
			try {
				this.sendSearchRequestMessage()
			} catch {}
		}, 300)
		setTimeout(() => {
			try {
				this.sendSearchRequestMessage()
			} catch {}
		}, 900)
	}

	/**
	 * Stop the discovery process
	 */
	stopDiscovery() {
		this.clearTimer(KNXTimer.DISCOVERY)
	}

	/**
	 * Returns an array of discovered KNX interfaces in the format "<ip>:<port>"
	 */
	public static async discover(eth?: string | number, timeout = 5000) {
		if (typeof eth === 'number') {
			timeout = eth
			eth = undefined
		}

		const baseKey = (host: string, sr: KNXSearchResponse) =>
			`${host}:${sr.deviceInfo?.name.replace(/:/g, ' ') ?? ''}:${
				sr.deviceInfo?.formattedAddress ?? ''
			}`

		const addResultsFromSearch = (
			hostKey: string,
			sr: KNXSearchResponse,
			collector: Map<
				string,
				{ secure: boolean; transport: 'UDP' | 'TCP' | 'Multicast' }
			>,
			isSecure: boolean,
		) => {
			const secFam: Map<number, number> | undefined = (sr as any)
				?.securedServiceFamilies?.services
			const hasSecTunnelling = !!secFam && secFam.has(0x04)
			const hasSecRouting = !!secFam && secFam.has(0x05)
			// Base entry (tunnelling)
			const base = baseKey(hostKey, sr)
			const existing = collector.get(base)
			let transport: 'UDP' | 'TCP' =
				existing?.transport === 'TCP' ? 'TCP' : 'UDP'
			// Prefer TCP if secure tunnelling is advertised
			if (hasSecTunnelling) transport = 'TCP'
			collector.set(base, {
				secure:
					existing?.secure ||
					isSecure ||
					hasSecTunnelling ||
					hasSecRouting,
				transport,
			})
			// If routing is supported, add a synthetic routing entry pointing to KNX multicast
			try {
				const families = sr?.serviceFamilies?.services
				if (families && families.has(0x05)) {
					const routingHost = `${KNX_CONSTANTS.KNX_IP}:${KNX_CONSTANTS.KNX_PORT}`
					const baseR = baseKey(routingHost, sr)
					const existingR = collector.get(baseR)
					collector.set(baseR, {
						secure:
							existingR?.secure ||
							isSecure ||
							hasSecTunnelling ||
							hasSecRouting,
						transport: existingR?.transport || 'Multicast',
					})
				}
			} catch {}
		}

		const results = new Map<
			string,
			{ secure: boolean; transport: 'UDP' | 'TCP' | 'Multicast' }
		>()

		// If a specific interface is provided, use a single client
		if (eth && typeof eth === 'string') {
			const protocols: KNXClientProtocol[] = ['Multicast', 'TunnelUDP']
			const clients = protocols.map((proto) => {
				const client = new KNXClient({
					interface: eth,
					hostProtocol: proto,
				})
				client.on(
					KNXClientEvents.discover,
					(host, header, searchResponse) => {
						addResultsFromSearch(
							host,
							searchResponse,
							results,
							header?.service_type ===
								KNX_CONSTANTS.SEARCH_RESPONSE_EXTENDED &&
								!!(searchResponse as any)
									?.securedServiceFamilies,
						)
					},
				)
				return client
			})
			try {
				clients.forEach((client) => {
					try {
						client.startDiscovery()
					} catch {}
				})
				await wait(timeout)
			} finally {
				await Promise.allSettled(
					clients.map((client) => client.Disconnect()),
				)
			}
			return Array.from(results.entries()).map(
				([k, meta]) =>
					`${k}:${meta.secure ? 'Secure KNX' : 'Plain KNX'}:${meta.transport}`,
			)
		}

		// Otherwise, try all IPv4 interfaces in parallel to maximize coverage
		const candidates = Object.keys(ipAddressHelper.getIPv4Interfaces())
		if (candidates.length === 0) return []

		const clients: KNXClient[] = []
		try {
			for (const name of candidates) {
				for (const proto of [
					'Multicast',
					'TunnelUDP',
				] as KNXClientProtocol[]) {
					const c = new KNXClient({
						interface: name,
						hostProtocol: proto,
					})
					c.on(KNXClientEvents.discover, (host, header, sr) => {
						addResultsFromSearch(
							host,
							sr,
							results,
							header?.service_type ===
								KNX_CONSTANTS.SEARCH_RESPONSE_EXTENDED &&
								!!(sr as any)?.securedServiceFamilies,
						)
					})
					clients.push(c)
				}
			}
			// Start discovery on all
			clients.forEach((c) => {
				try {
					c.startDiscovery()
				} catch {}
			})
			await wait(timeout)
		} finally {
			await Promise.allSettled(clients.map((c) => c.Disconnect()))
		}

		return Array.from(results.entries()).map(
			([k, meta]) =>
				`${k}:${meta.secure ? 'Secure KNX' : 'Plain KNX'}:${meta.transport}`,
		)
	}

	// New: detailed discovery returning enriched strings
	// Format: ip:port:name:ia:services:type
	public static async discoverDetailed(
		eth?: string | number,
		timeout = 5000,
	): Promise<string[]> {
		if (typeof eth === 'number') {
			timeout = eth
			eth = undefined
		}

		const servicesToString = (sr: KNXSearchResponse) => {
			const fam = sr?.serviceFamilies?.services
			if (!fam) return ''
			const names: string[] = []
			for (const id of fam.keys()) {
				switch (id) {
					case 0x05:
						names.push('routing')
						break
					case 0x04:
						names.push('tunnelling')
						break
					case 0x03:
						names.push('device_mgmt')
						break
					case 0x06:
						names.push('remlog')
						break
					case 0x07:
						names.push('remconf')
						break
					case 0x08:
						names.push('objsvr')
						break
					default:
						names.push(`0x${id.toString(16)}`)
				}
			}
			return names.join(',')
		}

		const detailed: Set<string> = new Set()

		const pushDetailed = (
			ip: string,
			port: number,
			sr: KNXSearchResponse,
			type: 'tunnelling' | 'routing',
		) => {
			const name = sr.deviceInfo?.name?.replace(/:/g, ' ') || ''
			const ia = sr.deviceInfo?.formattedAddress || ''
			const svc = servicesToString(sr)
			detailed.add(`${ip}:${port}:${name}:${ia}:${svc}:${type}`)
		}

		const handleSearch = (hostKey: string, sr: KNXSearchResponse) => {
			try {
				const [ip, p] = hostKey.split(':')
				const port = parseInt(p || '3671', 10)
				pushDetailed(ip, port, sr, 'tunnelling')
				const fam = sr?.serviceFamilies?.services
				if (fam && fam.has(0x05)) {
					pushDetailed(
						KNX_CONSTANTS.KNX_IP,
						KNX_CONSTANTS.KNX_PORT,
						sr,
						'routing',
					)
				}
			} catch {}
		}

		const runOnInterface = async (iface: string) => {
			const protocols: KNXClientProtocol[] = ['Multicast', 'TunnelUDP']
			const clients = protocols.map((proto) => {
				const c = new KNXClient({
					interface: iface,
					hostProtocol: proto,
				})
				c.on(KNXClientEvents.discover, (host, _h, sr) =>
					handleSearch(host, sr),
				)
				return c
			})
			try {
				clients.forEach((c) => {
					try {
						c.startDiscovery()
					} catch {}
				})
				await wait(timeout)
			} finally {
				await Promise.allSettled(clients.map((c) => c.Disconnect()))
			}
		}

		if (eth && typeof eth === 'string') {
			await runOnInterface(eth)
			return Array.from(detailed)
		}

		const candidates = Object.keys(ipAddressHelper.getIPv4Interfaces())
		for (const name of candidates) {
			await runOnInterface(name)
		}
		return Array.from(detailed)
	}

	public static async discoverInterfaces(
		eth?: string | number,
		timeout = 5000,
	): Promise<DiscoveryInterface[]> {
		if (typeof eth === 'number') {
			timeout = eth
			eth = undefined
		}

		const toList = (sr: KNXSearchResponse): string[] => {
			const fam = sr?.serviceFamilies?.services
			const names: string[] = []
			if (fam) {
				for (const id of fam.keys()) {
					switch (id) {
						case 0x05:
							names.push('routing')
							break
						case 0x04:
							names.push('tunnelling')
							break
						case 0x03:
							names.push('device_mgmt')
							break
						case 0x06:
							names.push('remlog')
							break
						case 0x07:
							names.push('remconf')
							break
						case 0x08:
							names.push('objsvr')
							break
						default:
							names.push(`0x${id.toString(16)}`)
					}
				}
			}
			return names
		}

		const out = new Map<string, DiscoveryInterface>()

		const push = (
			ip: string,
			port: number,
			sr: KNXSearchResponse,
			type: 'tunnelling' | 'routing',
		) => {
			const key = `${ip}:${port}:${type}`
			if (out.has(key)) return
			// Infer transport: routing => Multicast; tunnelling => UDP by default, TCP if secured tunnelling present
			let transport: 'UDP' | 'TCP' | 'Multicast' = 'UDP'
			if (type === 'routing') {
				transport = 'Multicast'
			} else {
				try {
					const secFam: Map<number, number> | undefined = (sr as any)
						?.securedServiceFamilies?.services
					if (secFam && secFam.has(0x04)) transport = 'TCP'
				} catch {}
			}
			out.set(key, {
				ip,
				port,
				name: sr.deviceInfo?.name?.replace(/:/g, ' ') || '',
				ia: sr.deviceInfo?.formattedAddress || '',
				services: toList(sr),
				type,
				transport,
			})
		}

		const handleSearch = (hostKey: string, sr: KNXSearchResponse) => {
			try {
				const [ip, p] = hostKey.split(':')
				const port = parseInt(p || '3671', 10)
				push(ip, port, sr, 'tunnelling')
				const fam = sr?.serviceFamilies?.services
				if (fam && fam.has(0x05)) {
					push(
						KNX_CONSTANTS.KNX_IP,
						KNX_CONSTANTS.KNX_PORT,
						sr,
						'routing',
					)
				}
			} catch {}
		}

		const runOnInterface = async (iface: string) => {
			const protocols: KNXClientProtocol[] = ['Multicast', 'TunnelUDP']
			const clients = protocols.map((proto) => {
				const c = new KNXClient({
					interface: iface,
					hostProtocol: proto,
				})
				c.on(KNXClientEvents.discover, (host, _h, sr) =>
					handleSearch(host, sr),
				)
				return c
			})
			try {
				clients.forEach((c) => {
					try {
						c.startDiscovery()
					} catch {}
				})
				await wait(timeout)
			} finally {
				await Promise.allSettled(clients.map((c) => c.Disconnect()))
			}
		}

		if (eth && typeof eth === 'string') {
			await runOnInterface(eth)
			return Array.from(out.values())
		}

		const candidates = Object.keys(ipAddressHelper.getIPv4Interfaces())
		for (const name of candidates) {
			await runOnInterface(name)
		}
		return Array.from(out.values())
	}

	public static async listSerialInterfaces(): Promise<SerialPortSummary[]> {
		return SerialFT12.listPorts()
	}

	/**
	 * Returns true if the gw description's gatherer is running
	 */
	isGatewayDescriptionRunning() {
		return this.timers.has(KNXTimer.GATEWAYDESCRIPTION)
	}

	/**
	 * Send a get description message to the KNX bus and wait for responses
	 * Set _clearToSend to true to allow the gatherer packet to process. Initially set to false to prevent premature sends.
	 */
	startGatewayDescription() {
		this._clearToSend = true
		if (this.isGatewayDescriptionRunning()) {
			throw new Error('GatewayDescription gather is already running')
		}
		this.setTimer(
			KNXTimer.GATEWAYDESCRIPTION,
			() => {},
			1000 * KNX_CONSTANTS.DEVICE_CONFIGURATION_REQUEST_TIMEOUT,
		)
		this.sendDescriptionRequestMessage()
	}

	/**
	 * Stop the process
	 */
	stopGatewayDescription() {
		this.clearTimer(KNXTimer.GATEWAYDESCRIPTION)
	}

	/**
	 * Returns an array of "search_responses" from the KNX interfaces in the format of a KNX descriptionResponse
	 */
	public static async getGatewayDescription(
		ipAddr: string,
		ipPort: string,
		eth?: string | number,
		timeout = 5000,
	) {
		if (typeof eth === 'number') {
			timeout = eth
			eth = undefined
		}

		const client = new KNXClient({
			ipAddr,
			ipPort,
			interface: eth as string,
			hostProtocol: 'TunnelUDP',
		})

		const descriptions = []

		client.on(KNXClientEvents.descriptionResponse, (searchResponse) => {
			descriptions.push(searchResponse)
		})

		client.startGatewayDescription()

		await wait(timeout)
		await client.Disconnect()

		return descriptions
	}

	// Resolve candidate secure interface IAs by discovering the gateway and matching keyring entries by Host IA
	private async secureGetIaCandidatesByDiscovery(): Promise<string[]> {
		const cfg = this._options.secureTunnelConfig
		if (!cfg) throw new Error('Secure config not provided')
		// Load keyring once to access interfaces
		const kr = new Keyring()
		const explicitPath = cfg.knxkeys_file_path?.trim()
		const path = explicitPath || undefined
		if (!path) {
			throw new Error(
				'IA discovery for KNX/IP Secure requires a .knxkeys file (set secureTunnelConfig.knxkeys_file_path).',
			)
		}
		const pwd = cfg.knxkeys_password?.trim()
		if (!pwd) {
			throw new Error(
				'IA discovery for KNX/IP Secure requires a keyring password (set secureTunnelConfig.knxkeys_password).',
			)
		}
		await kr.load(path, pwd)

		// Discover gateways and find the one matching ipAddr/ipPort
		const timeout = 3000
		let discovered: string[] = []
		// Prefer a single OS interface to speed up discovery and only use same-subnet interface if none specified
		let preferredIface = (this._options.interface as string) || ''
		if (!preferredIface) {
			try {
				const all = ipAddressHelper.getIPv4Interfaces()
				const ipToInt = (ip: string) =>
					ip
						.split('.')
						.map((x) => parseInt(x, 10))
						.reduce((a, b) => (a << 8) | (b & 0xff), 0) >>> 0
				const peer = ipToInt(this._peerHost)
				let matchBySubnet = ''
				for (const name of Object.keys(all)) {
					const addr = all[name]?.address
					const mask = all[name]?.netmask
					if (!addr || !mask) continue
					const a = ipToInt(addr)
					const m = ipToInt(mask)
					if ((a & m) === (peer & m)) {
						matchBySubnet = name
						break
					}
				}
				preferredIface = matchBySubnet
				// Fallback to localIPAddress matching name, else first iface — but still only one iface
				if (!preferredIface) {
					const local = this._options.localIPAddress
					for (const name of Object.keys(all)) {
						if (all[name]?.address === local) {
							preferredIface = name
							break
						}
					}
				}
				if (!preferredIface) preferredIface = Object.keys(all)[0] || ''
				if (this.isLevelEnabled('debug')) {
					this.sysLogger.debug(
						`[${getTimestamp()}] Secure TCP: discovery preferred iface=${preferredIface || 'none'}`,
					)
				}
			} catch {}
		}
		try {
			discovered = await KNXClient.discoverDetailed(
				preferredIface,
				timeout,
			)
		} catch {}
		// If nothing found quickly on preferred iface, try simple discover() on the SAME iface only (no broad scan)
		if (!discovered || discovered.length === 0) {
			try {
				const simple = await KNXClient.discover(
					preferredIface || undefined,
					5000,
				)
				// Map simple format to detailed-like for reuse of parsing logic
				discovered = (simple || []).map((s) => {
					// simple: ip:port:name:ia:Secure/Plain:transport
					// Convert to: ip:port:name:ia:services:type (type=tunnelling)
					const parts = s.split(':')
					if (parts.length < 6) return s
					return `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}:${parts[4]}:${'tunnelling'}`
				})
			} catch {}
		}
		try {
			if (this.isLevelEnabled('debug')) {
				this.sysLogger.debug(
					`[${getTimestamp()}] Secure TCP: discovery returned ${discovered.length} entries`,
				)
			}
		} catch {}
		const peerIp = this._peerHost
		const peerPort = this._peerPort || 3671
		let hostIa = ''
		for (const entry of discovered) {
			// Format: ip:port:name:ia:services:type
			const parts = entry.split(':')
			if (parts.length < 6) continue
			const [ip, p, _name, ia, _svc, type] = [
				parts[0],
				parseInt(parts[1] || '3671', 10),
				parts[2],
				parts[3],
				parts[4],
				parts[5],
			]
			if (ip === peerIp && p === peerPort && type === 'tunnelling') {
				hostIa = ia
				break
			}
		}
		// Fallback: match by IP only
		if (!hostIa) {
			try {
				this.sysLogger.debug(
					`[${getTimestamp()}] Secure TCP: no exact match ip:port; trying IP-only match for ${peerIp}`,
				)
			} catch {}
			for (const entry of discovered) {
				const parts = entry.split(':')
				if (parts.length < 6) continue
				const [ip, , , ia] = [parts[0], parts[1], parts[2], parts[3]]
				if (ip === peerIp) {
					hostIa = ia
					break
				}
			}
		}
		if (!hostIa) {
			throw new Error(
				`Discovery could not find gateway ${peerIp}:${peerPort} (tunnelling)`,
			)
		}
		try {
			if (this.isLevelEnabled('debug')) {
				this.sysLogger.debug(
					`[${getTimestamp()}] Secure TCP: discovered gateway IA ${hostIa} for ${peerIp}:${peerPort}`,
				)
			}
		} catch {}

		// Candidates: interfaces in keyring with Host == discovered IA
		let candidates: string[] = []
		for (const iface of kr.getInterfaces().values()) {
			if (iface?.host?.toString?.() === hostIa) {
				candidates.push(iface.individualAddress.toString())
			}
		}
		if (candidates.length === 0) {
			// Fallback: try all keyring interfaces of type "Tunneling"
			try {
				if (this.isLevelEnabled('warn')) {
					this.sysLogger.warn(
						`[${getTimestamp()}] Secure TCP: no interfaces matched Host ${hostIa}. Falling back to all keyring Tunneling interfaces.`,
					)
				}
			} catch {}
			for (const iface of kr.getInterfaces().values()) {
				if ((iface?.type || '').toLowerCase() === 'tunneling') {
					candidates.push(iface.individualAddress.toString())
				}
			}
			if (candidates.length === 0) {
				throw new Error(
					`No keyring interfaces available to try (Host ${hostIa}).`,
				)
			}
		}
		// Sort candidates by IA numeric value descending (typical tunnelling IAs near .254/.255)
		try {
			candidates = candidates.sort(
				(a, b) =>
					this.secureParseIndividualAddress(b) -
					this.secureParseIndividualAddress(a),
			)
		} catch {}
		try {
			this.sysLogger.info(
				`[${getTimestamp()}] Secure TCP: IA candidates from keyring (Host ${hostIa}) sorted: ${candidates.join(', ')}`,
			)
		} catch {}
		return candidates
	}

	// When IA is not specified, discover the gateway and try each keyring Interface (by Host) until connected
	private async secureConnectWithIaDiscovery(): Promise<void> {
		const cfg = this._options.secureTunnelConfig
		if (!cfg) throw new Error('Secure config missing')

		try {
			this.sysLogger.info(
				`[${getTimestamp()}] Secure TCP: IA discovery/selection started for ${this._peerHost}:${this._peerPort}`,
			)
		} catch {}

		// Build candidate list (IA strings)
		this._secureCandidateIAs = await this.secureGetIaCandidatesByDiscovery()
		this._secureCandidateIndex = 0
		try {
			this.sysLogger.info(
				`[${getTimestamp()}] Secure TCP: IA candidates: ${this._secureCandidateIAs.join(', ')}`,
			)
		} catch {}

		// Try candidates sequentially
		let lastErr: Error = null
		for (let i = 0; i < this._secureCandidateIAs.length; i++) {
			const ia = this._secureCandidateIAs[i]
			this._secureCandidateIndex = i
			// Reset per-attempt secure state so keyring derivation uses the new IA
			this._secureUserPasswordKey = undefined
			this._secureUserId = 2
			this._secureSerial = Buffer.from('000000000000', 'hex')
			this._secureAssignedIa = 0
			this._secureWrapperSeq = 0
			this._secureSearchProbed.clear()

			cfg.tunnelInterfaceIndividualAddress = ia
			try {
				this.sysLogger.info(
					`[${getTimestamp()}] Secure TCP: attempting IA ${ia}`,
				)
			} catch {}

			try {
				await this.secureEnsureKeyring()
			} catch (e) {
				lastErr = e as Error
				continue
			}

			// Ensure a clean TCP socket for each attempt
			try {
				await this.closeSocket()
			} catch {}
			this.initTcpSocket()
			this._connectionState = ConncetionState.CONNECTING

			const attempt = new Promise<void>((resolve, reject) => {
				let settled = false
				const onConn = () => {
					if (settled) return
					settled = true
					cleanup()
					resolve()
				}
				const onErr = (e: Error) => {
					if (settled) return
					settled = true
					cleanup()
					reject(e)
				}
				const onDisc = () => {
					if (settled) return
					settled = true
					cleanup()
					reject(new Error('Socket closed during connect'))
				}
				const timer = setTimeout(() => {
					if (settled) return
					settled = true
					cleanup()
					reject(new Error('Secure TCP connect timeout'))
				}, 6000)
				const cleanup = () => {
					clearTimeout(timer)
					this.off(KNXClientEvents.connected, onConn)
					this.off(KNXClientEvents.error, onErr)
					this.off(KNXClientEvents.disconnected, onDisc)
				}
				this.once(KNXClientEvents.connected, onConn)
				this.once(KNXClientEvents.error, onErr)
				this.once(KNXClientEvents.disconnected, onDisc)
				try {
					this.tcpSocket.connect(this._peerPort, this._peerHost)
				} catch (e) {
					cleanup()
					reject(e instanceof Error ? e : new Error(String(e)))
				}
			})

			try {
				await attempt
				// Success, stop trying
				return
			} catch (e) {
				lastErr = e as Error
				try {
					this.sysLogger.warn(
						`[${getTimestamp()}] Secure TCP: IA ${ia} failed: ${lastErr?.message || lastErr}`,
					)
				} catch {}
				// Continue to next candidate
			}
		}

		throw (
			lastErr ||
			new Error('No secure interface IA could connect successfully')
		)
	}

	/**
	 * Connect to the KNX bus
	 */
	Connect(knxLayer = TunnelTypes.TUNNEL_LINKLAYER) {
		if (!this.isSerialTransport() && this._clientSocket === null) {
			throw new Error('No client socket defined')
		}
		if (this._connectionState === ConncetionState.DISCONNECTING) {
			throw new Error(
				'Socket is disconnecting. Please wait until disconnected.',
			)
		}
		if (this._connectionState === ConncetionState.CONNECTING) {
			throw new Error(
				'Socket is connecting. Please wait until connected.',
			)
		}
		if (this._connectionState === ConncetionState.CONNECTED) {
			throw new Error('Socket is already connected. Disconnect first.')
		}

		this._connectionState = ConncetionState.CONNECTING
		this._numFailedTelegramACK = 0 // 25/12/2021 Reset the failed ACK counter
		this.clearToSend = true // 26/12/2021 allow to send
		this.clearTimer(KNXTimer.CONNECTION)
		// Emit connecting
		this.emit(KNXClientEvents.connecting, this._options)
		if (this.isSerialTransport()) {
			this.connectSerialTransport()
				.then(() => {
					this.socketReady = true
					this._connectionState = ConncetionState.CONNECTED
					this._numFailedTelegramACK = 0
					this.clearToSend = true
					this._clientTunnelSeqNumber = -1
					this.emit(KNXClientEvents.connected, this._options)
					this.handleKNXQueue()
				})
				.catch((err) => {
					this.emit(
						KNXClientEvents.error,
						err instanceof Error ? err : new Error(String(err)),
					)
				})
			return
		}
		if (this._options.hostProtocol === 'TunnelUDP') {
			// Unicast, need to explicitly create the connection
			const timeoutError = new Error(
				`Connection timeout to ${this._peerHost}:${this._peerPort}`,
			)
			this._awaitingResponseType = KNX_CONSTANTS.CONNECT_RESPONSE
			this._clientTunnelSeqNumber = -1
			this.setTimer(
				KNXTimer.CONNECTION,
				() => {
					this.emit(KNXClientEvents.error, timeoutError)
				},
				1000 * KNX_CONSTANTS.CONNECT_REQUEST_TIMEOUT,
			)
			// 27/06/2023, leave some time to the dgram, to do the bind and read local ip and local port
			this.setTimer(
				KNXTimer.CONNECT_REQUEST,
				() => {
					this.sendConnectRequestMessage(new TunnelCRI(knxLayer))
				},
				2000,
			)
		} else if (this._options.hostProtocol === 'TunnelTCP') {
			// KNX/IP Secure over TCP: if IA not provided, discover and try candidates
			const cfg = this._options.secureTunnelConfig
			const iaEmpty =
				!cfg?.tunnelInterfaceIndividualAddress ||
				cfg.tunnelInterfaceIndividualAddress.trim() === ''
			if (this._options.isSecureKNXEnabled && iaEmpty) {
				try {
					this.sysLogger.info(
						`[${getTimestamp()}] Secure TCP: no tunnel IA provided. Starting discovery-based selection for ${this._peerHost}:${this._peerPort}`,
					)
				} catch {}
				// Defer to next tick: select IA only, then proceed with normal connect
				setImmediate(() => {
					this.secureGetIaCandidatesByDiscovery()
						.then((cands) => {
							if (!cands || cands.length === 0)
								throw new Error('No secure IA candidates found')
							const chosen = cands[0]
							try {
								this.sysLogger.info(
									`[${getTimestamp()}] Secure TCP: selected IA ${chosen}`,
								)
							} catch {}
							this._options.secureTunnelConfig.tunnelInterfaceIndividualAddress =
								chosen
							return this.secureEnsureKeyring()
						})
						.then(() => {
							try {
								this.tcpSocket.connect(
									this._peerPort,
									this._peerHost,
								)
							} catch (err) {
								this.emit(
									KNXClientEvents.error,
									err instanceof Error
										? err
										: new Error('TCP connect error'),
								)
							}
						})
						.catch((err) => this.emit(KNXClientEvents.error, err))
				})
				return
			}
			// Otherwise, proceed with direct connect using provided IA
			this.secureEnsureKeyring()
				.then(() => {
					try {
						this.tcpSocket.connect(this._peerPort, this._peerHost)
					} catch (err) {
						this.emit(
							KNXClientEvents.error,
							err instanceof Error
								? err
								: new Error('TCP connect error'),
						)
					}
				})
				.catch((err) => this.emit(KNXClientEvents.error, err))
		} else {
			// Multicast
			// If secure routing requested, ensure keyring/backbone key is loaded (async, no need to await)
			if (this._options.isSecureKNXEnabled) {
				this.secureEnsureKeyring()
					.then(() => {
						if (!this._secureBackboneKey) {
							this.emit(
								KNXClientEvents.error,
								new Error(
									'No Backbone key found in keyring for secure multicast',
								),
							)
						}
					})
					.catch((err) => this.emit(KNXClientEvents.error, err))
			}
			// For multicast there is no handshake; emit connected at 'listening' only in plain mode
			// If socket is already listening and we're in plain mode, emit now
			if (this.socketReady && !this._options.isSecureKNXEnabled) {
				this._connectionState = ConncetionState.CONNECTED
				this._numFailedTelegramACK = 0
				this.clearToSend = true
				this._clientTunnelSeqNumber = -1
				this.emit(KNXClientEvents.connected, this._options)
			}
			// If secure mode, keep CONNECTING; will emit after first timer sync (0955/0950)
		}
	}

	/**
	 * Close the socket connection
	 */
	private async closeSocket() {
		this.exitProcessingKNXQueueLoop = true // Exits KNX processing queue loop
		return new Promise<void>((resolve) => {
			// already closed
			if (!this._clientSocket) return

			this.socketReady = false

			const client = this._clientSocket

			this._clientSocket = null

			const cb = () => {
				resolve()
			}

			try {
				if (client instanceof TCPSocket) {
					// use destroy instead of end here to ensure socket is closed
					client.destroy()
				} else {
					;(client as UDPSocket).close(cb)
				}
			} catch (error) {
				this.sysLogger.error(
					`KNXClient: into async closeSocket(): ${error.stack}`,
				)
				resolve()
			}
		})
	}

	/**
	 * Sends a DISCONNECT_REQUEST telegram to the BUS and closes the socket
	 */
	async Disconnect() {
		if (!this.isSerialTransport() && this._clientSocket === null) {
			throw new Error('No client socket defined')
		}

		if (this._connectionState === ConncetionState.DISCONNECTING) {
			throw new Error('Already disconnecting')
		}

		// clear active timers
		this.clearAllTimers()

		if (this.isSerialTransport()) {
			this._connectionState = ConncetionState.DISCONNECTING
			this.exitProcessingKNXQueueLoop = true
			await this.closeSerialTransport()
			this._connectionState = ConncetionState.DISCONNECTED
			this.emit(KNXClientEvents.disconnected, 'Serial interface closed')
			return
		}

		this._connectionState = ConncetionState.DISCONNECTING

		// 20/04/2022 this._channelID === null can happen when the KNX Gateway is already disconnected
		if (this._channelID === null) {
			// 11/10/2022 Close the socket
			this.sysLogger.debug(
				`[${getTimestamp()}] ` +
					`KNXClient: into Disconnect(), channel id is not defined so skip disconnect packet and close socket`,
			)
			await this.closeSocket()
			return
		}

		this._awaitingResponseType = KNX_CONSTANTS.DISCONNECT_RESPONSE
		this.sendDisconnectRequestMessage(this._channelID)

		// wait for disconnect event or at most 2 seconds
		await this.waitForEvent(KNXClientEvents.disconnected, 2000)

		// fix #54 : disconnect request is not sent properly
		this.exitProcessingKNXQueueLoop = true // Exits KNX processing queue loop

		// 12/03/2021 Set disconnected if not already set by DISCONNECT_RESPONSE sent from the IP Interface
		if (this._connectionState !== ConncetionState.DISCONNECTED) {
			this.setDisconnected(
				"Forced call from KNXClient Disconnect() function, because the KNX Interface hasn't sent the DISCONNECT_RESPONSE in time.",
			)
		}

		if (this._options.sniffingMode) {
			this.sysLogger.info(
				'Sniffing mode is enabled. Dumping sniffing buffers...',
			)
			this.sysLogger.info(this.sniffingPackets)
		}
	}

	/**
	 * Returns true if the socket is connected
	 */
	isConnected() {
		return this._connectionState === ConncetionState.CONNECTED
	}

	/**
	 * Close the socket connection without sending a disconnect request
	 */
	private async setDisconnected(_sReason = '') {
		this.sysLogger.debug(
			`[${getTimestamp()}] ` +
				`KNXClient: called _setDisconnected ${this._peerHost}:${this._peerPort} ${_sReason}`,
		)
		this._connectionState = ConncetionState.DISCONNECTED

		// clear active timers
		this.clearAllTimers()

		this._clientTunnelSeqNumber = -1
		this._channelID = null

		if (this.isSerialTransport()) {
			await this.closeSerialTransport()
		} else {
			await this.closeSocket()
		}

		this.emit(
			KNXClientEvents.disconnected,
			`${this._peerHost}:${this._peerPort} ${_sReason}`,
		)
		this.clearToSend = true // 26/12/2021 allow to send
	}

	/**
	 * Send a connection state request message to the KNX bus and schedule the next heartbeat
	 */
	private runHeartbeat() {
		if (this.isSerialTransport()) {
			return
		}
		if (!this._heartbeatRunning) {
			return
		}

		if (this._clientSocket == null) {
			throw new Error('No client socket defined')
		}

		const deadError = new Error(
			`Connection dead with ${this._peerHost}:${this._peerPort}`,
		)

		// timeout triggered if no connection state response received
		this.setTimer(
			KNXTimer.CONNECTION_STATE,
			() => {
				// First misses can happen transiently; warn until final attempt
				const attempt = this._heartbeatFailures + 1
				const level =
					attempt >= this.max_HeartbeatFailures ? 'error' : 'warn'
				;(this.sysLogger as any)[level](
					`KNXClient: getConnectionStatus timeout attempt ${attempt}/${this.max_HeartbeatFailures} to ${this._peerHost}:${this._peerPort} ch:${this._channelID}`,
				)
				// this.emit(KNXClientEvents.error, timeoutError)

				this._heartbeatFailures++
				if (this._heartbeatFailures >= this.max_HeartbeatFailures) {
					this._heartbeatFailures = 0
					this.emit(KNXClientEvents.error, deadError)
					this.setDisconnected(deadError.message)
				}
			},
			1000 * KNX_CONSTANTS.CONNECTIONSTATE_REQUEST_TIMEOUT,
		)
		this._awaitingResponseType = KNX_CONSTANTS.CONNECTIONSTATE_RESPONSE
		this.sendConnectionStateRequestMessage(this._channelID)

		// schedule next heartbeat
		this.setTimer(
			KNXTimer.HEARTBEAT,
			() => {
				this.runHeartbeat()
			},
			1000 * this._options.connectionKeepAliveTimeout,
		)
	}

	/**
	 * Get actual tunneling sequence number
	 */
	private getSeqNumber() {
		return this._clientTunnelSeqNumber
	}

	private getCurrentItemHandledByTheQueue() {
		return this.currentItemHandledByTheQueue.expectedSeqNumberForACK
	}

	// Secure Tunneling (TCP) sequence helpers
	private secureGetTunnelSeq() {
		return this._secureTunnelSeq & 0xff
	}

	private secureIncTunnelSeq() {
		const v = this._secureTunnelSeq & 0xff
		this._secureTunnelSeq = (this._secureTunnelSeq + 1) & 0xff
		return v
	}

	/**
	 * Increment the tunneling sequence number
	 */
	private incSeqNumber() {
		this._clientTunnelSeqNumber++
		if (this._clientTunnelSeqNumber > 255) {
			this._clientTunnelSeqNumber = 0
		}
		return this._clientTunnelSeqNumber
	}

	/**
	 * Setup a timer while waiting for an ACK of `knxTunnelingRequest`
	 */
	private setTimerWaitingForACK(knxTunnelingRequest: KNXTunnelingRequest) {
		this.clearToSend = false // 26/12/2021 stop sending until ACK received
		const timeoutErr = new errors.RequestTimeoutError(
			`seqCounter:${knxTunnelingRequest.seqCounter}, DestAddr:${
				knxTunnelingRequest.cEMIMessage.dstAddress.toString() ||
				'Non definito'
			},  AckRequested:${
				knxTunnelingRequest.cEMIMessage.control.ack
			}, timed out waiting telegram acknowledge by ${
				this._peerHost || 'No Peer host detected'
			}`,
		)
		this.setTimer(
			KNXTimer.ACK,
			() => {
				this._numFailedTelegramACK += 1
				if (this._numFailedTelegramACK > 2) {
					this._numFailedTelegramACK = 0
					// 08/04/2022 Emits the event informing that the last ACK has not been acknowledge.
					this.emit(
						KNXClientEvents.ackReceived,
						knxTunnelingRequest,
						false,
					)
					this.clearToSend = true
					this.emit(KNXClientEvents.error, timeoutErr)
					this.sysLogger.error(
						`KNXClient: _setTimerWaitingForACK: ${
							timeoutErr.message || 'Undef error'
						} no ACK received. ABORT sending datagram with seqNumber ${this.getSeqNumber()} from ${knxTunnelingRequest.cEMIMessage.srcAddress.toString()} to ${knxTunnelingRequest.cEMIMessage.dstAddress.toString()}`,
					)
				} else {
					// 26/12/2021 // If no ACK received, resend the datagram once with the same sequence number
					this.sysLogger.error(
						`KNXClient: _setTimerWaitingForACK: ${
							timeoutErr.message || 'Undef error'
						} no ACK received. Retransmit datagram with seqNumber ${
							this.currentItemHandledByTheQueue
								.expectedSeqNumberForACK
						} from ${knxTunnelingRequest.cEMIMessage.srcAddress.toString()} to ${knxTunnelingRequest.cEMIMessage.dstAddress.toString()}`,
					)
					this.send(
						knxTunnelingRequest,
						knxTunnelingRequest,
						true,
						this.currentItemHandledByTheQueue
							.expectedSeqNumberForACK,
					)
				}
			},
			KNX_CONSTANTS.TUNNELING_REQUEST_TIMEOUT * 1000,
		)
	}

	/**
	 * Utility function
	 */
	private getKNXConstantName(serviceType: number): string | undefined {
		const entry = Object.entries(KNX_CONSTANTS).find(
			([, value]) => value === serviceType,
		)
		return entry ? entry[0] : undefined
	}

	/**
	 * Process a raw message coming from the socket
	 */
	private processInboundMessage(msg: Buffer, rinfo: RemoteInfo) {
		let sProcessInboundLog = ''
		try {
			const { knxHeader, knxMessage } = KNXProtocol.parseMessage(msg)

			// If we're waiting on a heartbeat reply but receive any frame from the
			// same peer, consider the connection alive and reset the heartbeat timer.
			try {
				if (
					this.timers.has(KNXTimer.CONNECTION_STATE) &&
					this._connectionState === ConncetionState.CONNECTED &&
					rinfo?.address === this._peerHost &&
					rinfo?.port === this._peerPort
				) {
					this.clearTimer(KNXTimer.CONNECTION_STATE)
					this._heartbeatFailures = 0
					this.sysLogger.debug(
						`[${getTimestamp()}] Heartbeat satisfied by inbound traffic from ${rinfo.address}:${rinfo.port}`,
					)
				}
			} catch {}

			// Composing debug string
			sProcessInboundLog = `peerHost:${this._peerHost}:${this._peerPort}`
			sProcessInboundLog += ` srcAddress:${rinfo?.address}:${rinfo?.port}`
			sProcessInboundLog += ` channelID:${this._channelID === null || this._channelID === undefined ? 'None' : this._channelID}`
			sProcessInboundLog += ` service_type:${this.getKNXConstantName(knxHeader?.service_type)}`
			sProcessInboundLog += ` knxHeader:${JSON.stringify(knxHeader)} knxMessage:${JSON.stringify(knxMessage)}`
			sProcessInboundLog += ` raw: ${msg.toString('hex')}`
			this.sysLogger.debug(
				`[${getTimestamp()}] ` +
					`KNXEngine: <incoming telegram>: ${sProcessInboundLog} `,
			)

			if (this._options.sniffingMode) {
				const lastEntry =
					this.sniffingPackets[this.sniffingPackets.length - 1]
				if (lastEntry) {
					// last entry already has a response, so create a new entry
					if (lastEntry.response) {
						this.sniffingPackets.push({
							reqType: knxMessage.constructor.name,
							response: msg.toString('hex'),
							deltaReq: Date.now() - this.lastSnifferRequest,
						})
					} else {
						lastEntry.response = msg.toString('hex')
						lastEntry.resType = knxMessage.constructor.name
						lastEntry.deltaRes =
							Date.now() - this.lastSnifferRequest
					}
				}
			}
			// 26/12/2021 ROUTING LOST MESSAGE OR BUSY
			if (knxHeader.service_type === KNX_CONSTANTS.ROUTING_LOST_MESSAGE) {
				this.emit(
					KNXClientEvents.error,
					new Error('ROUTING_LOST_MESSAGE'),
				)
				// this._setDisconnected("Routing Lost Message"); // 31/03/2022 Commented, because it doesn't matter. Non need to disconnect.
				return
			}
			if (knxHeader.service_type === KNX_CONSTANTS.ROUTING_BUSY) {
				this.emit(KNXClientEvents.error, new Error('ROUTING_BUSY'))
				// this._setDisconnected("Routing Busy"); // 31/03/2022 Commented, because it doesn't matter. Non need to disconnect.
				return
			}

			if (
				knxHeader.service_type === KNX_CONSTANTS.SEARCH_RESPONSE ||
				knxHeader.service_type ===
					KNX_CONSTANTS.SEARCH_RESPONSE_EXTENDED
			) {
				if (!this.isDiscoveryRunning()) return
				// After receiving a plain SEARCH_RESPONSE, also try a unicast SECURE_SEARCH_REQUEST
				// to the responding host to increase chances of detecting Secure KNX capability.
				try {
					if (
						knxHeader.service_type === KNX_CONSTANTS.SEARCH_RESPONSE
					) {
						const key = `${rinfo.address}:${KNX_CONSTANTS.KNX_PORT}`
						if (
							!this._secureSearchProbed.has(key) &&
							this.udpSocket
						) {
							this._secureSearchProbed.add(key)
							this.sendSecureSearchRequestTo(
								rinfo.address,
								KNX_CONSTANTS.KNX_PORT,
							)
						}
					}
				} catch {}
				// Prefer the port advertised by the interface (HPAI). If missing/zero, default to 3671.
				try {
					const sr: any = knxMessage as any
					let advertisedPort = sr?.hpai?.port
					if (!advertisedPort || advertisedPort === 0) {
						advertisedPort = KNX_CONSTANTS.KNX_PORT
					}
					this.emit(
						KNXClientEvents.discover,
						`${rinfo.address}:${advertisedPort}`,
						knxHeader,
						sr as KNXSearchResponse,
					)
				} catch {
					// Fallback to the source port if anything goes wrong
					this.emit(
						KNXClientEvents.discover,
						`${rinfo.address}:${rinfo.port}`,
						knxHeader,
						knxMessage as KNXSearchResponse,
					)
				}
			} else if (
				knxHeader.service_type === KNX_CONSTANTS.DESCRIPTION_RESPONSE
			) {
				const knxDescriptionResponse =
					knxMessage as KNXDescriptionResponse

				this.sysLogger.debug(
					`[${getTimestamp()}] ` +
						`Received KNX packet: TUNNELING: DESCRIPTION_RESPONSE, ChannelID:${this._channelID} DescriptionResponse:${JSON.stringify(knxDescriptionResponse)} Host:${this._options.ipAddr}:${this._options.ipPort}`,
				)
				this.emit(
					KNXClientEvents.descriptionResponse,
					knxDescriptionResponse,
				)
			} else if (
				knxHeader.service_type === KNX_CONSTANTS.CONNECT_RESPONSE
			) {
				if (this._connectionState === ConncetionState.CONNECTING) {
					this.clearTimer(KNXTimer.CONNECTION)
					const knxConnectResponse = knxMessage as KNXConnectResponse
					if (
						knxConnectResponse.status !==
						ConnectionStatus.E_NO_ERROR
					) {
						this.emit(
							KNXClientEvents.error,
							Error(
								KNXConnectResponse.statusToString(
									knxConnectResponse.status,
								),
							),
						)
						this.setDisconnected(
							`Connect response error ${knxConnectResponse.status}`,
						)
						return
					}

					// 16/03/2022
					this.clearTimer(KNXTimer.ACK)
					this._channelID = knxConnectResponse.channelID
					this._connectionState = ConncetionState.CONNECTED
					this._numFailedTelegramACK = 0 // 16/03/2022 Reset the failed ACK counter
					this.clearToSend = true // 16/03/2022 allow to send
					// Use the tunnel-assigned IA as source only for TCP secure
					try {
						if (
							(this._options.hostProtocol === 'TunnelTCP' ||
								this._options.hostProtocol === 'TunnelUDP') &&
							this.physAddr === undefined
						) {
							const assignedIa =
								knxConnectResponse?.crd?.knxAddress?.get?.()
							if (
								typeof assignedIa === 'number' &&
								assignedIa > 0
							) {
								this.physAddr = new KNXAddress(
									assignedIa,
									KNXAddress.TYPE_INDIVIDUAL,
								)
								this.sysLogger.debug(
									`[${getTimestamp()}] Tunnelling assigned IA set to ${this.physAddr.toString()}`,
								)
							}
						}
					} catch {}
					this.emit(KNXClientEvents.connected, this._options)
					if (!this._options.sniffingMode) {
						this.startHeartBeat()
					}
				}
			} else if (
				knxHeader.service_type === KNX_CONSTANTS.DISCONNECT_RESPONSE
			) {
				if (this._connectionState !== ConncetionState.DISCONNECTING) {
					this.emit(
						KNXClientEvents.error,
						new Error('Unexpected Disconnect Response.'),
					)
				}
				this.setDisconnected(
					'Received DISCONNECT_RESPONSE from the KNX interface.',
				)
			} else if (
				knxHeader.service_type === KNX_CONSTANTS.DISCONNECT_REQUEST
			) {
				const knxDisconnectRequest = knxMessage as KNXDisconnectResponse
				if (knxDisconnectRequest.channelID !== this._channelID) {
					return
				}

				this._connectionState = ConncetionState.DISCONNECTING
				this.sendDisconnectResponseMessage(
					knxDisconnectRequest.channelID,
				)

				// 12/03/2021 Added 1 sec delay.
				this.setTimer(
					KNXTimer.DISCONNECT,
					() => {
						this.setDisconnected(
							`Received KNX packet: DISCONNECT_REQUEST, ChannelID:${this._channelID} Host:${this._peerHost}:${this._peerPort}`,
						)
					},
					1000,
				)
			} else if (
				knxHeader.service_type === KNX_CONSTANTS.TUNNELING_REQUEST
			) {
				const knxTunnelingRequest = knxMessage as KNXTunnelingRequest
				if (knxTunnelingRequest.channelID !== this._channelID) {
					this.sysLogger.debug(
						`[${getTimestamp()}] ` +
							`Received KNX packet: TUNNELING: L_DATA_IND, NOT FOR ME: MyChannelID:${this._channelID} ReceivedPacketChannelID: ${knxTunnelingRequest.channelID} ReceivedPacketseqCounter:${knxTunnelingRequest.seqCounter} Host:${this._options.ipAddr}:${this._options.ipPort}`,
					)
					return
				}
				try {
					const knxTunnelAck = KNXProtocol.newKNXTunnelingACK(
						knxTunnelingRequest.channelID,
						knxTunnelingRequest.seqCounter,
						KNX_CONSTANTS.E_NO_ERROR,
					)
					this.send(
						knxTunnelAck,
						undefined,
						true, // Gives the priority into the queue! It must be replied ASAP.
						this.getSeqNumber(),
					)
				} catch (error) {
					this.sysLogger.error(
						`Received KNX packet: TUNNELING: L_DATA_IND, ERROR BUILDING THE TUNNELINK ACK: ${error.message}`,
					)
				}

				if (
					knxTunnelingRequest.cEMIMessage.msgCode ===
					CEMIConstants.L_DATA_IND
				) {
					// Ensure plain KNX (decrypt Data Secure if needed) and emit full telegram
					this.ensurePlainCEMI(knxTunnelingRequest.cEMIMessage)
					this.emit(
						KNXClientEvents.indication,
						knxTunnelingRequest as any,
						false,
					)
				} else if (
					knxTunnelingRequest.cEMIMessage.msgCode ===
					CEMIConstants.L_DATA_CON
				) {
					this.sysLogger.debug(
						`[${getTimestamp()}] ` +
							`Received KNX packet: TUNNELING: L_DATA_CON, dont' care.`,
					)
				}
			} else if (knxHeader.service_type === KNX_CONSTANTS.TUNNELING_ACK) {
				const knxTunnelingAck = knxMessage as KNXTunnelingAck
				if (knxTunnelingAck.channelID !== this._channelID) {
					return
				}

				// Check the received ACK sequence number
				if (!this._options.suppress_ack_ldatareq) {
					if (
						knxTunnelingAck.seqCounter ===
						this.getCurrentItemHandledByTheQueue()
					) {
						this.clearTimer(KNXTimer.ACK)
						this._numFailedTelegramACK = 0 // 25/12/2021 clear the current ACK failed telegram number
						this.clearToSend = true // I'm ready to send a new datagram now
						// 08/04/2022 Emits the event informing that the last ACK has been acknowledge.
						this.emit(
							KNXClientEvents.ackReceived,
							knxTunnelingAck,
							true,
						)
						this.sysLogger.debug(
							`[${getTimestamp()}] ` +
								`Received KNX packet: TUNNELING: DELETED_TUNNELING_ACK FROM PENDING ACK's, ChannelID:${this._channelID} seqCounter:${knxTunnelingAck.seqCounter} Host:${this._options.ipAddr}:${this._options.ipPort}`,
						)
					} else {
						// Inform that i received an ACK with an unexpected sequence number. It should be handled as error, but for now, only log.
						this.sysLogger.error(
							`Received KNX packet: TUNNELING: Unexpected Tunnel Ack with seqCounter = ${knxTunnelingAck.seqCounter}, expecting ${this.getCurrentItemHandledByTheQueue()}. Don't care for now.`,
						)
						this.clearTimer(KNXTimer.ACK)
						this._numFailedTelegramACK = 0 // 25/12/2021 clear the current ACK failed telegram number
						this.clearToSend = true // I'm ready to send a new datagram now
						// 08/04/2022 Emits the event informing that the last ACK has been acknowledge.
						this.emit(
							KNXClientEvents.ackReceived,
							knxTunnelingAck,
							true,
						)
						// this.emit(KNXClientEvents.error, `Unexpected Tunnel Ack ${knxTunnelingAck.seqCounter}`);
					}
				} else {
					this.clearToSend = true // I'm ready to send a new datagram now
				}
			} else if (
				knxHeader.service_type === KNX_CONSTANTS.ROUTING_INDICATION
			) {
				// 07/12/2021 Multicast routing indication
				const knxRoutingInd = knxMessage as KNXRoutingIndication
				if (
					knxRoutingInd.cEMIMessage.msgCode ===
					CEMIConstants.L_DATA_IND
				) {
					// Ensure plain KNX (decrypt Data Secure if needed) and emit full telegram
					this.ensurePlainCEMI(knxRoutingInd.cEMIMessage)
					this.emit(
						KNXClientEvents.indication,
						knxRoutingInd as any,
						false,
					)
				} else if (
					knxRoutingInd.cEMIMessage.msgCode ===
					CEMIConstants.L_DATA_CON
				) {
					this.sysLogger.debug(
						`[${getTimestamp()}] ` +
							`Received KNX packet: ROUTING: L_DATA_CON, don't care.`,
					)
				}
			} else {
				if (knxHeader.service_type === this._awaitingResponseType) {
					if (
						this._awaitingResponseType ===
						KNX_CONSTANTS.CONNECTIONSTATE_RESPONSE
					) {
						this.sysLogger.debug(
							`[${getTimestamp()}] ` +
								`Received KNX packet: CONNECTIONSTATE_RESPONSE, ChannelID:${this._channelID} Host:${this._options.ipAddr}:${this._options.ipPort}`,
						)

						const knxConnectionStateResponse =
							knxMessage as KNXConnectionStateResponse
						if (
							knxConnectionStateResponse.status !==
							KNX_CONSTANTS.E_NO_ERROR
						) {
							this.emit(
								KNXClientEvents.error,
								Error(
									KNXConnectionStateResponse.statusToString(
										knxConnectionStateResponse.status,
									),
								),
							)
							this.setDisconnected(
								`Awaiting response ${this._awaitingResponseType}, received connection state response  with status ${knxConnectionStateResponse.status}`,
							)
						} else {
							this.clearTimer(KNXTimer.CONNECTION_STATE)
							this._heartbeatFailures = 0
						}
					} else {
						this.clearTimer(KNXTimer.CONNECTION)
					}
				}
				this.emit(
					KNXClientEvents.response,
					`${rinfo.address}:${rinfo.port}`,
					knxHeader,
					knxMessage as KnxResponse,
				)
			}
		} catch (e) {
			this.sysLogger.error(
				`Received KNX packet: Error processing inbound message: ${e.message} ${sProcessInboundLog} ChannelID:${this._channelID} Host:${this._options.ipAddr}:${this._options.ipPort}. This means that KNX-Ultimate received a malformed Header or CEMI message from your KNX Gateway.`,
			)
		}
	}

	// ===== KNX/IP Secure Support (migrated from SecureTunnelTCP) =====
	private async secureEnsureKeyring(): Promise<void> {
		if (!this._options?.secureTunnelConfig) return
		const cfg = this._options.secureTunnelConfig
		// Peer host/port now come from KNXClientOptions.ipAddr/ipPort (not from secure config)
		// Drive secure logs from KNXClientOptions.loglevel; no separate boolean

		// Determine whether we have a keyring available
		const explicitPath = cfg.knxkeys_file_path?.trim()
		const keyringPath = explicitPath || undefined
		const hasKeyring = !!keyringPath

		const rawTunnelUserId = cfg.tunnelUserId as unknown
		let normalizedTunnelUserId: number | undefined
		if (typeof rawTunnelUserId === 'string') {
			const parsed = Number(rawTunnelUserId.trim())
			normalizedTunnelUserId = Number.isNaN(parsed) ? undefined : parsed
		} else if (typeof rawTunnelUserId === 'number') {
			normalizedTunnelUserId = Number.isNaN(rawTunnelUserId)
				? undefined
				: rawTunnelUserId
		}
		const hasConfiguredUserId = typeof normalizedTunnelUserId === 'number'

		// Reset caches that may depend on keyring contents
		this._secureGroupKeys = new Map()
		this._secureBackboneKey = undefined
		this._secureKeyring = undefined

		// Initialize Data Secure sender sequence (48-bit)
		const base = Date.parse('2018-01-05T00:00:00Z')
		this._secureSendSeq48 = BigInt(Date.now() - base)

		const isTunnelTCP = this._options.hostProtocol === 'TunnelTCP'

		if (hasKeyring) {
			const kr = new Keyring()
			const pwd = cfg.knxkeys_password?.trim()
			if (!pwd) {
				throw new Error(
					'KNX/IP Secure requires secureTunnelConfig.knxkeys_password when secureTunnelConfig.knxkeys_file_path is provided.',
				)
			}
			await kr.load(keyringPath!, pwd)
			this._secureKeyring = kr

			const iface = cfg.tunnelInterfaceIndividualAddress
				? kr.getInterface(cfg.tunnelInterfaceIndividualAddress)
				: undefined

			if (isTunnelTCP) {
				let userId: number | undefined
				if (hasConfiguredUserId) {
					userId = normalizedTunnelUserId!
				} else if (typeof iface?.userId === 'number') {
					userId = iface.userId
				}
				if (typeof userId !== 'number') {
					throw new Error(
						'KNX/IP Secure requires tunnelUserId when secureTunnelConfig.knxkeys_file_path is provided but the keyring lacks the interface user ID.',
					)
				}
				this._secureUserId = userId
				const password = (
					iface?.decryptedPassword ||
					cfg.tunnelUserPassword ||
					''
				).trim()
				if (!password) {
					throw new Error(
						'KNX/IP Secure requires a tunnel user password; set secureTunnelConfig.tunnelUserPassword or provide one in the keyring.',
					)
				}

				// Derive user password key
				this._secureUserPasswordKey = crypto.pbkdf2Sync(
					Buffer.from(password, 'latin1'),
					Buffer.from('user-password.1.secure.ip.knx.org', 'latin1'),
					65536,
					16,
					'sha256',
				)
			}

			// Load group keys (optional for Data Secure). Secure routing does not require them
			for (const [gaStr, g] of kr.getGroupAddresses()) {
				if (!g.decryptedKey) continue
				const ga = this.secureParseGroupAddress(gaStr)
				this._secureGroupKeys.set(ga, g.decryptedKey.slice(0, 16))
			}

			// Pick KNX Serial from gateway device if available
			const gatewayIaStr =
				iface?.host?.toString() || iface?.individualAddress?.toString()
			const dev = gatewayIaStr ? kr.getDevice(gatewayIaStr) : undefined
			if (dev?.serialNumber) {
				try {
					const ser = Buffer.from(dev.serialNumber, 'hex')
					if (ser.length === 6) this._secureSerial = ser
				} catch {}
			}

			// Load Backbone key for secure multicast routing (if present)
			try {
				const backbones = kr.getBackbones()
				if (backbones && backbones.length > 0) {
					const bb = backbones[0]
					if (bb?.decryptedKey && bb.decryptedKey.length >= 16) {
						this._secureBackboneKey = bb.decryptedKey.subarray(
							0,
							16,
						)
					}
					if (typeof bb?.latency === 'number') {
						this._secureRoutingLatencyMs = Math.max(100, bb.latency)
					}
				}
			} catch (e) {
				this.sysLogger.warn(
					`Secure multicast: cannot read backbone key/latency: ${(e as Error).message}`,
				)
			}
			return
		}

		// Manual mode: derive credentials directly from provided tunnel password
		const manualPassword = cfg.tunnelUserPassword
		if (!manualPassword) {
			throw new Error(
				'KNX/IP Secure requires either a .knxkeys file or tunnelUserPassword.',
			)
		}
		if (!hasConfiguredUserId) {
			throw new Error(
				'KNX/IP Secure requires secureTunnelConfig.tunnelUserId when no keyring is provided.',
			)
		}

		this._secureUserId = normalizedTunnelUserId!
		this._secureUserPasswordKey = crypto.pbkdf2Sync(
			Buffer.from(manualPassword, 'latin1'),
			Buffer.from('user-password.1.secure.ip.knx.org', 'latin1'),
			65536,
			16,
			'sha256',
		)
		this._secureSerial = Buffer.from('000000000000', 'hex')
		try {
			if (this.isLevelEnabled('info')) {
				this.sysLogger.info(
					`[${getTimestamp()}] Secure TCP: using manual tunnel password (no keyring). Data Secure features disabled. tunnelUserId=${this._secureUserId}`,
				)
			}
		} catch {}
	}

	private async secureStartSession(): Promise<void> {
		// Prepare keyring if needed
		await this.secureEnsureKeyring()

		// Generate ephemeral X25519 key pair
		const keyPair = crypto.generateKeyPairSync('x25519')
		this._securePrivateKey = keyPair.privateKey
		const exported = keyPair.publicKey.export({
			type: 'spki',
			format: 'der',
		}) as Buffer
		// Last 32 bytes contain raw public key
		this._securePublicKey = exported.subarray(exported.length - 32)

		this._secureHandshakeState = 'session'
		// Send SESSION_REQUEST immediately
		try {
			this.sysLogger.debug(
				`[${getTimestamp()}] TX 0951 SECURE_SESSION_REQUEST to ${this._peerHost}:${this._peerPort}`,
			)
		} catch {}
		this.tcpSocket.write(this.secureBuildSessionRequest())
		// Session timeout
		this._secureHandshakeSessionTimer = setTimeout(() => {
			this.emit(
				KNXClientEvents.error,
				new Error('Timeout waiting for SESSION_RESPONSE'),
			)
		}, SECURE_SESSION_TIMEOUT_MS)
	}

	private secureOnTcpData(data: Buffer) {
		// Accumulate and parse complete KNX/IP frames (length from header bytes 4..5)
		this._tcpRxBuffer = Buffer.concat([this._tcpRxBuffer, data])
		while (this._tcpRxBuffer.length >= 6) {
			const totalLen = this._tcpRxBuffer.readUInt16BE(4)
			if (this._tcpRxBuffer.length < totalLen) break
			const frame = this._tcpRxBuffer.subarray(0, totalLen)
			this._tcpRxBuffer = this._tcpRxBuffer.subarray(totalLen)

			const type = frame.readUInt16BE(2)
			if (
				type === KNXIP.SECURE_SESSION_RESPONSE &&
				this._secureHandshakeState === 'session'
			) {
				if (this._secureHandshakeSessionTimer) {
					clearTimeout(this._secureHandshakeSessionTimer)
					this._secureHandshakeSessionTimer = undefined
				}
				// SESSION_RESPONSE
				try {
					this.sysLogger.debug(
						`[${getTimestamp()}] RX 0952 SECURE_SESSION_RESPONSE sid=${frame.readUInt16BE(6)}`,
					)
				} catch {}
				this._secureSessionId = frame.readUInt16BE(6)
				const serverPublicKey = frame.subarray(8, 40)

				// Compute session key
				const X25519_SPKI_PREFIX_DER = Buffer.from(
					'302a300506032b656e032100',
					'hex',
				)
				const serverKey = crypto.createPublicKey({
					key: Buffer.concat([
						X25519_SPKI_PREFIX_DER,
						serverPublicKey,
					]),
					format: 'der',
					type: 'spki',
				})
				const secret = crypto.diffieHellman({
					privateKey: this._securePrivateKey!,
					publicKey: serverKey,
				})
				const sessHash = crypto
					.createHash('sha256')
					.update(secret)
					.digest()
				this._secureSessionKey = sessHash.subarray(0, 16)

				// Send SESSION_AUTHENTICATE (wrapped)
				const authFrame =
					this.secureBuildSessionAuthenticate(serverPublicKey)
				try {
					this.sysLogger.debug(
						`[${getTimestamp()}] TX 0953 SECURE_SESSION_AUTHENTICATE (wrapped) sid=${this._secureSessionId}`,
					)
				} catch {}
				this.tcpSocket.write(this.secureWrap(authFrame))
				this._secureHandshakeState = 'auth'
				this._secureHandshakeAuthTimer = setTimeout(() => {
					this.emit(
						KNXClientEvents.error,
						new Error('Timeout waiting for SESSION_STATUS'),
					)
				}, SECURE_AUTH_TIMEOUT_MS)
			} else if (type === KNXIP.SECURE_WRAPPER) {
				const inner = this.secureDecrypt(frame)
				const innerType = inner.readUInt16BE(2)
				if (
					innerType === KNXIP.SECURE_SESSION_STATUS &&
					this._secureHandshakeState === 'auth'
				) {
					try {
						this.sysLogger.debug(
							`[${getTimestamp()}] RX 0954 SECURE_SESSION_STATUS status=${inner[6]}`,
						)
					} catch {}
					if (this._secureHandshakeAuthTimer) {
						clearTimeout(this._secureHandshakeAuthTimer)
						this._secureHandshakeAuthTimer = undefined
					}
					// On success (status 0), send CONNECT_REQUEST (slight delay improves reliability)
					const status = inner[6]
					if (status !== 0) {
						const reason = this.secureDescribeSessionStatus(status)
						const err = new Error(
							reason ||
								`Secure session failed with status ${status}`,
						)
						this.emit(KNXClientEvents.error, err)
						this._secureHandshakeState = undefined
						this.setDisconnected(
							reason ||
								`Secure session failed (status ${status})`,
						).catch(() => {})
						return
					}
					const conn = this.secureBuildConnectRequest()
					setTimeout(() => {
						try {
							this.sysLogger.debug(
								`[${getTimestamp()}] TX 0205 TUNNELING_CONNECT_REQUEST (wrapped)`,
							)
						} catch {}
						this.tcpSocket.write(this.secureWrap(conn))
						this._secureHandshakeState = 'connect'
						this._secureHandshakeConnectTimer = setTimeout(
							() =>
								this.emit(
									KNXClientEvents.error,
									new Error(
										'Timeout waiting for CONNECT_RESPONSE',
									),
								),
							SECURE_CONNECT_TIMEOUT_MS,
						)
					}, CONNECT_SEND_DELAY_MS)
				} else if (
					innerType === KNXIP.TUNNELING_CONNECT_RESPONSE &&
					this._secureHandshakeState === 'connect'
				) {
					// CONNECT_RESPONSE
					if (this._secureHandshakeConnectTimer) {
						clearTimeout(this._secureHandshakeConnectTimer)
						this._secureHandshakeConnectTimer = undefined
					}
					const ch = inner[6]
					const status = inner[7]
					// Parse assigned IA from CRD after HPAI
					const hpaiLen = inner[8]
					const crdPos = 8 + hpaiLen
					if (inner.length >= crdPos + 4) {
						this._secureAssignedIa =
							(inner[crdPos + 2] << 8) | inner[crdPos + 3]
						try {
							const iaStr = `${(this._secureAssignedIa >> 12) & 0x0f}.${(this._secureAssignedIa >> 8) & 0x0f}.${this._secureAssignedIa & 0xff}`
							this.sysLogger.debug(
								`[${getTimestamp()}] RX 0206 TUNNELING_CONNECT_RESPONSE ch=${ch} status=${status} assignedIA=${iaStr}`,
							)
						} catch {}
					}
					if (status === 0) {
						// Promote to KNXClient connected state
						this._channelID = ch
						// Ensure queue processing is enabled after tunnel established
						this.exitProcessingKNXQueueLoop = false
						// Update source IA to the tunnel-assigned IA for Data Secure correctness on bus
						try {
							if (this._secureAssignedIa) {
								this.physAddr = new KNXAddress(
									this._secureAssignedIa,
									KNXAddress.TYPE_INDIVIDUAL,
								)
							}
						} catch {}
						this._connectionState = ConncetionState.CONNECTED
						this._numFailedTelegramACK = 0
						this.clearToSend = true
						this.emit(KNXClientEvents.connected, this._options)
						// For TunnelTCP, start the first heartbeat quickly to keep
						// the tunnel alive on gateways with short idle timeouts.
						try {
							const keep =
								this._options.connectionKeepAliveTimeout ||
								KNX_CONSTANTS.CONNECTION_ALIVE_TIME
							// Schedule first heartbeat at ~keep/10 (min 2s, max 5s)
							const delayMs = Math.max(
								2000,
								Math.min(5000, Math.floor((keep * 1000) / 10)),
							)
							this.setTimer(
								KNXTimer.HEARTBEAT,
								() => this.startHeartBeat(),
								delayMs,
							)
						} catch {}
						this.handleKNXQueue()
					}
				} else {
					// Feed decrypted inner KNX/IP frames into the regular pipeline
					const rinfo: RemoteInfo = {
						address: this._peerHost,
						port: this._peerPort,
						family: 'IPv4',
						size: inner.length,
					} as any
					this.processInboundMessage(inner, rinfo)
				}
			} else if (
				type === KNXIP.TUNNELING_CONNECT_RESPONSE &&
				this._secureHandshakeState === 'connect'
			) {
				// Plain fallback CONNECT_RESPONSE (rare)
				if (this._secureHandshakeConnectTimer) {
					clearTimeout(this._secureHandshakeConnectTimer)
					this._secureHandshakeConnectTimer = undefined
				}
				const ch = frame[6]
				const status = frame[7]
				if (status === 0) {
					this._channelID = ch
					this._connectionState = ConncetionState.CONNECTED
					this._numFailedTelegramACK = 0
					this.clearToSend = true
					this.emit(KNXClientEvents.connected, this._options)
					this.startHeartBeat()
					this.handleKNXQueue()
				}
			} else {
				// Other plaintext frames: route to parser if relevant
				const rinfo: RemoteInfo = {
					address: this._peerHost,
					port: this._peerPort,
					family: 'IPv4',
					size: frame.length,
				} as any
				this.processInboundMessage(frame, rinfo)
			}
		}
	}

	private secureWrap(frame: Buffer): Buffer {
		if (!this._secureSessionKey)
			throw new Error('Secure session not established')
		const seq = Buffer.alloc(SECURE_SEQ_LEN)
		seq.writeUIntBE(this._secureWrapperSeq++, 0, SECURE_SEQ_LEN)

		const len = SECURE_WRAPPER_OVERHEAD + frame.length
		const hdr = Buffer.concat([
			KNXIP_HDR_SECURE_WRAPPER,
			Buffer.from([len >> 8, len & 0xff]),
		])
		const additionalData = Buffer.concat([
			hdr,
			Buffer.from([
				this._secureSessionId >> 8,
				this._secureSessionId & 0xff,
			]),
		])
		const block0 = Buffer.concat([
			seq,
			this._secureSerial,
			SECURE_WRAPPER_TAG,
			Buffer.from([frame.length >> 8, frame.length & 0xff]),
		])
		const blocks = Buffer.concat([
			block0,
			Buffer.from([0x00, additionalData.length]),
			additionalData,
			frame,
		])
		const padded = Buffer.concat([
			blocks,
			Buffer.alloc((16 - (blocks.length % 16)) % 16, 0),
		])
		const cipher = crypto.createCipheriv(
			'aes-128-cbc',
			this._secureSessionKey,
			Buffer.alloc(AES_BLOCK_LEN, 0),
		)
		cipher.setAutoPadding(false)
		const encrypted = Buffer.concat([cipher.update(padded), cipher.final()])
		const macCbc = encrypted.subarray(encrypted.length - MAC_LEN_FULL)

		const ctr0 = Buffer.concat([
			seq,
			this._secureSerial,
			SECURE_WRAPPER_CTR_SUFFIX,
		])
		const ctr = crypto.createCipheriv(
			'aes-128-ctr',
			this._secureSessionKey,
			ctr0,
		)
		const encMac = ctr.update(macCbc)
		const encData = ctr.update(frame)

		return Buffer.concat([
			hdr,
			Buffer.from([
				this._secureSessionId >> 8,
				this._secureSessionId & 0xff,
			]),
			seq,
			this._secureSerial,
			SECURE_WRAPPER_TAG,
			encData,
			encMac,
		])
	}

	private secureDescribeSessionStatus(status: number): string {
		switch (status) {
			case 0:
				return 'Secure session established'
			case 1:
				return 'Secure session authentication failed: verify secureTunnelConfig.tunnelUserPassword and tunnelUserId.'
			case 2:
				return 'Secure session rejected by gateway (access denied or disabled user).'
			case 3:
				return 'Secure session aborted due to sequence or timing mismatch.'
			case 4:
				return 'Secure session aborted because the gateway detected a cryptographic integrity error.'
			default:
				return ''
		}
	}

	// ===== KNX/IP Secure Multicast (routing) helpers =====
	private secureRoutingTimerValue(): number {
		// Monotonic-ish timer in ms; adjust by offset if synchronized
		const now = performance.now()
		const v = Math.floor(now + this._secureRoutingTimerOffsetMs)
		// Constrain to 48-bit range
		return Math.max(0, Math.min(v, 0xffffffffffff))
	}

	private secureRoutingEmitConnectedIfPending() {
		try {
			if (
				this._options.hostProtocol === 'Multicast' &&
				this._options.isSecureKNXEnabled &&
				this._connectionState === ConncetionState.CONNECTING
			) {
				this._connectionState = ConncetionState.CONNECTED
				this._numFailedTelegramACK = 0
				this.clearToSend = true
				this._clientTunnelSeqNumber = -1
				this.emit(KNXClientEvents.connected, this._options)
			}
		} catch {}
	}

	// Send a single TimerNotify (0x0955) to trigger timer authentication for secure routing.
	private secureSendTimerNotify(messageTag?: Buffer) {
		if (!this.udpSocket) return
		if (!this._secureBackboneKey) return
		try {
			// Build TimerNotify
			const timerValue = this.secureRoutingTimerValue()
			const timerBytes = Buffer.alloc(SECURE_SEQ_LEN)
			timerBytes.writeUIntBE(timerValue, 0, SECURE_SEQ_LEN)
			const tag =
				messageTag && messageTag.length === 2
					? messageTag
					: crypto.randomBytes(2)
			const serial = this._secureSerial
			// Additional data = KNX/IP header of TimerNotify (06 10 09 55 00 24)
			const additional = Buffer.from('061009550024', 'hex')
			// Block0 = timer(6) + serial(6) + tag(2) + 00 00
			const b0 = Buffer.concat([
				timerBytes,
				serial,
				tag,
				Buffer.from([0x00, 0x00]),
			])
			const macCbc = calculateMessageAuthenticationCodeCBC(
				this._secureBackboneKey,
				additional,
				Buffer.alloc(0),
				b0,
			)
			// CTR-enc mac with counter0 = timer + serial + tag + ff 00
			const ctr0 = Buffer.concat([
				timerBytes,
				serial,
				tag,
				Buffer.from([0xff, 0x00]),
			])
			const [, mac] = encryptDataCtr(
				this._secureBackboneKey,
				ctr0,
				macCbc,
			)
			// Assemble full 0x0955 frame
			const body = Buffer.concat([timerBytes, serial, tag, mac])
			const hdr = Buffer.from('061009550024', 'hex')
			const frame = Buffer.concat([hdr, body])
			this.udpSocket.send(frame, this._peerPort, this._peerHost, () => {})
			try {
				if (this.isLevelEnabled('debug')) {
					this.sysLogger.debug(
						`[${getTimestamp()}] TX 0955 TimerNotify timer=${timerValue} tag=${tag.toString('hex')}`,
					)
				}
			} catch {}
		} catch {}
	}

	private secureWrapRouting(inner: Buffer): Buffer {
		if (!this._secureBackboneKey) throw new Error('Backbone key not set')
		const seqNum = this.secureRoutingTimerValue()
		const seq = Buffer.alloc(SECURE_SEQ_LEN)
		seq.writeUIntBE(seqNum, 0, SECURE_SEQ_LEN)
		const tag = crypto.randomBytes(2)
		const sid = 0 // routing uses session id 0
		const totalLen = SECURE_WRAPPER_OVERHEAD + inner.length
		const hdr = Buffer.concat([
			KNXIP_HDR_SECURE_WRAPPER,
			Buffer.from([(totalLen >> 8) & 0xff, totalLen & 0xff]),
		])
		const sidBytes = Buffer.from([0x00, 0x00])
		const additionalData = Buffer.concat([hdr, sidBytes])
		const block0 = Buffer.concat([
			seq,
			this._secureSerial,
			tag,
			Buffer.from([(inner.length >> 8) & 0xff, inner.length & 0xff]),
		])
		const blocks = Buffer.concat([
			block0,
			Buffer.from([0x00, additionalData.length]),
			additionalData,
			inner,
		])
		const padded = Buffer.concat([
			blocks,
			Buffer.alloc((16 - (blocks.length % 16)) % 16, 0),
		])
		const cipher = crypto.createCipheriv(
			'aes-128-cbc',
			this._secureBackboneKey,
			Buffer.alloc(AES_BLOCK_LEN, 0),
		)
		cipher.setAutoPadding(false)
		const encrypted = Buffer.concat([cipher.update(padded), cipher.final()])
		const macCbc = encrypted.subarray(encrypted.length - MAC_LEN_FULL)

		const ctr0 = Buffer.concat([
			seq,
			this._secureSerial,
			tag,
			Buffer.from([0xff, 0x00]),
		])
		const ctr = crypto.createCipheriv(
			'aes-128-ctr',
			this._secureBackboneKey,
			ctr0,
		)
		const encMac = ctr.update(macCbc)
		const encData = ctr.update(inner)

		return Buffer.concat([
			hdr,
			Buffer.from([sid >> 8, sid & 0xff]),
			seq,
			this._secureSerial,
			tag,
			encData,
			encMac,
		])
	}

	private secureDecryptRouting(wrapper: Buffer): Buffer {
		if (!this._secureBackboneKey)
			throw new Error('Backbone key not set for secure routing')
		// Validate header
		if (wrapper.length < 6 + 2 + 6 + 6 + 2 + 16)
			throw new Error('Invalid SecureWrapper length')
		const service = wrapper.readUInt16BE(2)
		if (service !== KNX_CONSTANTS.SECURE_WRAPPER)
			throw new Error('Not a SecureWrapper')
		const sid = wrapper.readUInt16BE(6)
		if (sid !== 0) throw new Error('Unexpected session id for routing')
		const seq = wrapper.subarray(8, 14)
		const serial = wrapper.subarray(14, 20)
		const tag = wrapper.subarray(20, 22)
		const encData = wrapper.subarray(22, wrapper.length - MAC_LEN_FULL)
		const mac = wrapper.subarray(wrapper.length - MAC_LEN_FULL)

		// CTR decrypt
		const ctr0 = Buffer.concat([
			seq,
			serial,
			tag,
			SECURE_WRAPPER_MAC_SUFFIX,
		])
		const [plain, macTr] = decryptCtr(
			this._secureBackboneKey,
			ctr0,
			mac,
			encData,
		)
		// Verify MAC (CBC over additional data + payload)
		const hdr = wrapper.subarray(0, 6)
		const additional = Buffer.concat([hdr, Buffer.from([0x00, 0x00])])
		const b0 = Buffer.concat([
			seq,
			serial,
			tag,
			Buffer.from([(plain.length >> 8) & 0xff, plain.length & 0xff]),
		])
		const macCbc = calculateMessageAuthenticationCodeCBC(
			this._secureBackboneKey,
			additional,
			plain,
			b0,
		)
		if (!macCbc.equals(macTr)) {
			throw new Error('SecureWrapper MAC verification failed')
		}
		return plain
	}

	private secureOnUdpData(msg: Buffer, rinfo: RemoteInfo) {
		try {
			if (!msg || msg.length < 6) return
			const service = msg.readUInt16BE(2)
			if (service === KNX_CONSTANTS.SECURE_WRAPPER) {
				if (!this._options.isSecureKNXEnabled) return
				// Decrypt and forward inner KNX/IP frame
				const inner = this.secureDecryptRouting(msg)
				// Optional: basic timer handling (update max received timer)
				try {
					// Extract sequence information to update timer offset
					const seq = msg.subarray(8, 14)
					const timerValue = seq.readUIntBE(0, 6)
					const localNow = Math.floor(performance.now())
					const delta = timerValue - localNow
					if (!this._secureRoutingTimerAuthenticated) {
						this._secureRoutingTimerOffsetMs = delta
						this._secureRoutingTimerAuthenticated = true
						// Align Data Secure sender seq to routing timer (timer strategy)
						try {
							const tv = BigInt(timerValue)
							if (this._secureSendSeq48 < tv)
								this._secureSendSeq48 = tv
						} catch {}
						try {
							this.sysLogger.debug(
								`[${getTimestamp()}] Secure routing timer authenticated. remote=${timerValue} local=${localNow} offset=${delta}ms`,
							)
						} catch {}
						// If we were connecting in secure multicast, now we can emit connected
						this.secureRoutingEmitConnectedIfPending()
					}
				} catch {}
				const rin: RemoteInfo = {
					address: rinfo.address,
					port: rinfo.port,
					family: rinfo.family,
					size: inner.length,
				} as any
				this.processInboundMessage(inner, rin)
				return
			}
			if (service === KNX_CONSTANTS.SECURE_GROUP_SYNC) {
				// TimerNotify: verify MAC and adjust timer
				try {
					if (!this._secureBackboneKey) return
					if (msg.length < 0x24) return
					const seq = msg.subarray(6, 12)
					const serial = msg.subarray(12, 18)
					const tag = msg.subarray(18, 20)
					const mac = msg.subarray(20, 36)
					const ctr0 = Buffer.concat([
						seq,
						serial,
						tag,
						Buffer.from([0xff, 0x00]),
					])
					const [, macTr] = decryptCtr(
						this._secureBackboneKey,
						ctr0,
						mac,
					)
					// additional data is fixed header 06 10 09 55 00 24
					const additional = Buffer.from('061009550024', 'hex')
					const b0 = Buffer.concat([
						seq,
						serial,
						tag,
						Buffer.from([0x00, 0x00]),
					])
					const macCbc = calculateMessageAuthenticationCodeCBC(
						this._secureBackboneKey,
						additional,
						Buffer.alloc(0),
						b0,
					)
					if (macCbc.equals(macTr)) {
						const t = seq.readUIntBE(0, 6)
						const localNow = Math.floor(performance.now())
						this._secureRoutingTimerOffsetMs = t - localNow
						this._secureRoutingTimerAuthenticated = true
						// Align Data Secure sender seq to routing timer
						try {
							const tv = BigInt(t)
							if (this._secureSendSeq48 < tv)
								this._secureSendSeq48 = tv
						} catch {}
						try {
							this.sysLogger.debug(
								`[${getTimestamp()}] TimerNotify authenticated. remote=${t} local=${localNow} offset=${this._secureRoutingTimerOffsetMs}ms`,
							)
						} catch {}
						this.secureRoutingEmitConnectedIfPending()
					}
				} catch (e) {
					// ignore timer errors
				}
				return
			}

			// Fallback: forward as plain
			this.processInboundMessage(msg, rinfo)
		} catch (e) {
			this.emit(
				KNXClientEvents.error,
				e instanceof Error ? e : new Error('UDP secure routing error'),
			)
		}
	}

	// ===== Logging level helpers =====
	private getLoggerLevel(): LogLevel {
		try {
			const lvl = (this.sysLogger as any)?.level || 'info'
			return String(lvl).toLowerCase() as LogLevel
		} catch {
			return 'info'
		}
	}

	private isLevelEnabled(level: LogLevel): boolean {
		const order: Record<LogLevel, number> = {
			disable: 0,
			error: 1,
			warn: 2,
			info: 3,
			debug: 4,
			trace: 5,
		}
		const cur = this.getLoggerLevel()
		return order[cur] >= order[level]
	}

	private secureDecrypt(frame: Buffer): Buffer {
		if (!this._secureSessionKey)
			throw new Error('Secure session not established')
		const seq = frame.subarray(8, 14)
		const serial = frame.subarray(14, 20)
		const tag = frame.subarray(20, 22)
		const data = frame.subarray(22, frame.length - 16)
		const ctr0 = Buffer.concat([
			seq,
			serial,
			tag,
			SECURE_WRAPPER_MAC_SUFFIX,
		])
		const dec = crypto.createDecipheriv(
			'aes-128-ctr',
			this._secureSessionKey,
			ctr0,
		)
		dec.update(frame.subarray(frame.length - MAC_LEN_FULL))
		return dec.update(data)
	}

	private secureBuildSessionRequest(): Buffer {
		// 06 10 | 09 51 | len | HPAI | <client public key 32B>
		const bodyLen = HPAI_CONTROL_ENDPOINT_EMPTY.length + PUBLIC_KEY_LEN
		const len = bodyLen + KNXIP_HEADER_LEN
		return Buffer.concat([
			KNXIP_HDR_SECURE_SESSION_REQUEST,
			Buffer.from([(len >> 8) & 0xff, len & 0xff]),
			HPAI_CONTROL_ENDPOINT_EMPTY,
			this._securePublicKey!,
		])
	}

	private secureBuildSessionAuthenticate(serverPublicKey: Buffer): Buffer {
		const xor = Buffer.alloc(PUBLIC_KEY_LEN)
		for (let i = 0; i < PUBLIC_KEY_LEN; i++)
			xor[i] = this._securePublicKey![i] ^ serverPublicKey[i]

		const additionalData = Buffer.concat([
			KNXIP_HDR_SECURE_SESSION_AUTHENTICATE,
			Buffer.from([0x00, 0x18]),
			Buffer.from([0x00, this._secureUserId]),
			xor,
		])
		const block0 = Buffer.alloc(AES_BLOCK_LEN, 0)
		const blocks = Buffer.concat([
			block0,
			Buffer.from([0x00, additionalData.length]),
			additionalData,
		])
		const padded = Buffer.concat([
			blocks,
			Buffer.alloc(
				(AES_BLOCK_LEN - (blocks.length % AES_BLOCK_LEN)) %
					AES_BLOCK_LEN,
				0,
			),
		])
		const cipher = crypto.createCipheriv(
			'aes-128-cbc',
			this._secureUserPasswordKey!,
			Buffer.alloc(AES_BLOCK_LEN, 0),
		)
		cipher.setAutoPadding(false)
		const encrypted = Buffer.concat([cipher.update(padded), cipher.final()])
		const macCbc = encrypted.subarray(encrypted.length - AES_BLOCK_LEN)
		const ctr = crypto.createCipheriv(
			'aes-128-ctr',
			this._secureUserPasswordKey!,
			AUTH_CTR_IV,
		)
		const mac = ctr.update(macCbc)
		const authBodyLen = 1 + 1 + AES_BLOCK_LEN
		const authLen = authBodyLen + KNXIP_HEADER_LEN
		return Buffer.concat([
			KNXIP_HDR_SECURE_SESSION_AUTHENTICATE,
			Buffer.from([(authLen >> 8) & 0xff, authLen & 0xff]),
			Buffer.from([0x00]),
			Buffer.from([this._secureUserId]),
			mac,
		])
	}

	private secureBuildConnectRequest(): Buffer {
		// 06 10 | 02 05 | len | HPAI ctrl | HPAI data | CRD (04 04 02 00)
		const bodyLen =
			HPAI_CONTROL_ENDPOINT_EMPTY.length +
			HPAI_DATA_ENDPOINT_EMPTY.length +
			CRD_TUNNEL_LINKLAYER.length
		const len = bodyLen + KNXIP_HEADER_LEN
		return Buffer.concat([
			KNXIP_HDR_TUNNELING_CONNECT_REQUEST,
			Buffer.from([(len >> 8) & 0xff, len & 0xff]),
			HPAI_CONTROL_ENDPOINT_EMPTY,
			HPAI_DATA_ENDPOINT_EMPTY,
			CRD_TUNNEL_LINKLAYER,
		])
	}

	// Data Secure helpers (available for future use)
	private secureBuildSecureApdu(
		groupAddr: number,
		plainApdu: Buffer,
		cemiFlags: number,
		srcIa: number,
	): Buffer {
		const key = this._secureGroupKeys.get(groupAddr)
		if (!key)
			throw new Error(
				`No Data Secure key for GA ${this.secureFormatGroupAddress(groupAddr)}`,
			)
		const seq = Buffer.alloc(SECURE_SEQ_LEN)
		const current = this._secureSendSeq48 & 0xffffffffffffn
		seq.writeUIntBE(Number(current), 0, 6)
		this._secureSendSeq48 = (this._secureSendSeq48 + 1n) & 0xffffffffffffn
		const addrFields = Buffer.from([
			(srcIa >> 8) & 0xff,
			srcIa & 0xff,
			(groupAddr >> 8) & 0xff,
			groupAddr & 0xff,
		])
		const frameFlagsMasked = cemiFlags & 0xffff
		const block0 = Buffer.concat([
			seq,
			addrFields,
			Buffer.from([
				0x00,
				frameFlagsMasked & 0xff & SEC_CEMI.CTRL2_RELEVANT_MASK,
				(TPCI_DATA << 2) + APCI_SEC.HIGH,
				APCI_SEC.LOW,
				0x00,
				plainApdu.length,
			]),
		])
		const macCbcFull = calculateMessageAuthenticationCodeCBC(
			key,
			Buffer.from([SCF_ENCRYPTION_S_A_DATA]),
			plainApdu,
			block0,
		)
		const macCbc4 = macCbcFull.subarray(0, 4)
		const counter0 = Buffer.concat([
			seq,
			addrFields,
			DATA_SECURE_CTR_SUFFIX,
		])
		const [encPayload, encMac] = encryptDataCtr(
			key,
			counter0,
			macCbc4,
			plainApdu,
		)
		// Optional deep debug for Data Secure, helpful to compare with reference implementation
		try {
			if (this.isLevelEnabled('debug')) {
				const iaStr = `${(srcIa >> 12) & 0x0f}.${(srcIa >> 8) & 0x0f}.${srcIa & 0xff}`
				this.sysLogger.debug(
					`[${getTimestamp()}] DS build: dst=${this.secureFormatGroupAddress(groupAddr)} src=${iaStr} flags=0x${(cemiFlags & 0xffff).toString(16)} plain=${plainApdu.toString('hex')} seq48=${seq.toString('hex')} block0=${block0.toString('hex')} ctr0=${counter0.toString('hex')}`,
				)
			}
		} catch {}
		return Buffer.concat([
			APCI_SEC.HEADER,
			Buffer.from([SCF_ENCRYPTION_S_A_DATA]),
			seq,
			encPayload,
			encMac,
		])
	}

	// For multicast+Data Secure: try to pick an allowed sender IA for the GA
	private securePickSenderIaForGa(
		gaRaw: number,
		currIa?: number,
	): number | undefined {
		try {
			const gaStr = this.secureFormatGroupAddress(gaRaw)
			// If current IA è consentita, mantienila
			const allowed = new Set<number>()
			const ifaces = this._secureKeyring?.getInterfaces?.()
			if (ifaces) {
				for (const [, i] of ifaces) {
					const senders = i.groupAddresses?.get?.(gaStr) || []
					for (const s of senders) allowed.add(s.raw)
				}
			}
			if (currIa && allowed.has(currIa)) return currIa

			// Altrimenti scegli un mittente consentito (il più alto in modo deterministico)
			if (allowed.size > 0) {
				return Array.from(allowed).sort((a, b) => b - a)[0]
			}
		} catch {}
		return currIa
	}

	private secureBuildLDataReq(
		secureApdu: Buffer,
		srcIa: number,
		ga: number,
		flags: number,
	): Buffer {
		return Buffer.concat([
			Buffer.from([SEC_CEMI.L_DATA_REQ, SEC_CEMI.ADDITIONAL_INFO_NONE]),
			Buffer.from([(flags >> 8) & 0xff, flags & 0xff]),
			Buffer.from([(srcIa >> 8) & 0xff, srcIa & 0xff]),
			Buffer.from([(ga >> 8) & 0xff, ga & 0xff]),
			Buffer.from([secureApdu.length - 1]),
			secureApdu,
		])
	}

	private secureParseGroupAddress(ga: string): number {
		const [m, mi, s] = ga.split('/').map(Number)
		return ((m & 0x1f) << 11) | ((mi & 0x07) << 8) | (s & 0xff)
	}

	private secureFormatGroupAddress(raw: number): string {
		const m = (raw >> 11) & 0x1f
		const mi = (raw >> 8) & 0x07
		const s = raw & 0xff
		return `${m}/${mi}/${s}`
	}

	private secureParseIndividualAddress(ia: string): number {
		const [a, l, d] = ia.split('.').map(Number)
		return ((a & 0x0f) << 12) | ((l & 0x0f) << 8) | (d & 0xff)
	}

	// Apply Data Secure to an outgoing cEMI if GA has a key in keyring
	private maybeApplyDataSecure(cemi: any) {
		try {
			if (!this._options.isSecureKNXEnabled) return
			if (!this._secureGroupKeys || this._secureGroupKeys.size === 0)
				return
			// Already secure? don't re-apply (avoid consuming a new seq48)
			if (
				cemi?.npdu &&
				(cemi.npdu.tpci & 0xff) === APCI_SEC.HIGH &&
				(cemi.npdu.apci & 0xff) === APCI_SEC.LOW
			)
				return
			const dst = cemi?.dstAddress?.get?.() as number
			if (typeof dst !== 'number') return
			if (!this._secureGroupKeys.has(dst)) return
			let src = (this._secureAssignedIa ||
				(cemi?.srcAddress?.get?.() as number)) as number
			if (typeof src !== 'number') return
			// For multicast routing: ensure source IA is allowed for the GA, otherwise pick one from keyring
			if (this._options.hostProtocol === 'Multicast') {
				const picked = this.securePickSenderIaForGa(dst, src)
				if (picked && picked !== src) {
					src = picked
					this._secureAssignedIa = picked
					try {
						this.sysLogger.debug(
							`[${getTimestamp()}] Secure multicast: override src IA to allowed ${(picked >> 12) & 0x0f}.${(picked >> 8) & 0x0f}.${picked & 0xff} for GA ${this.secureFormatGroupAddress(dst)}`,
						)
					} catch {}
				}
			}
			const ctrlBuf: Buffer = cemi?.control?.toBuffer?.()
			if (!Buffer.isBuffer(ctrlBuf) || ctrlBuf.length < 2) return
			const flags16 = (ctrlBuf[0] << 8) | ctrlBuf[1]
			const npdu = cemi?.npdu
			if (!npdu) return
			const dataPart: Buffer = npdu.dataBuffer
				? npdu.dataBuffer.value
				: Buffer.alloc(0)
			const plainApdu = Buffer.concat([
				Buffer.from([npdu.tpci & 0xff, npdu.apci & 0xff]),
				dataPart,
			])
			const secureApduFull = this.secureBuildSecureApdu(
				dst,
				plainApdu,
				flags16,
				src,
			)
			// Replace NPDU header + data with SecureAPDU
			npdu.tpci = APCI_SEC.HIGH
			npdu.apci = APCI_SEC.LOW
			npdu.data = new KNXDataBuffer(secureApduFull.subarray(2))
			// Ensure srcAddress reflects the assigned IA used on the bus (TunnelTCP) or current physAddr (Multicast)
			try {
				if (src) {
					cemi.srcAddress = new KNXAddress(
						src,
						KNXAddress.TYPE_INDIVIDUAL,
					)
				}
			} catch {}
			// Update cEMI message length to reflect the new NPDU size
			try {
				cemi.length = CEMIMessage.GetLength(
					cemi.additionalInfo,
					cemi.control,
					cemi.srcAddress,
					cemi.dstAddress,
					cemi.npdu,
				)
			} catch {}
		} catch (e) {
			this.sysLogger.error(
				`maybeApplyDataSecure error: ${(e as Error).message}`,
			)
		}
	}

	// Decrypt incoming Data Secure NPDU in-place if applicable
	private maybeDecryptDataSecure(cemi: any) {
		try {
			if (!this._options.isSecureKNXEnabled) return
			if (!this._secureGroupKeys || this._secureGroupKeys.size === 0)
				return
			const npdu = cemi?.npdu
			if (!npdu) return
			if (
				(npdu.tpci & 0xff) !== APCI_SEC.HIGH ||
				(npdu.apci & 0xff) !== APCI_SEC.LOW
			)
				return
			const dst = cemi?.dstAddress?.get?.() as number
			const src = cemi?.srcAddress?.get?.() as number
			if (typeof dst !== 'number' || typeof src !== 'number') return
			const key = this._secureGroupKeys.get(dst)
			if (!key) return
			const ctrlBuf: Buffer = cemi?.control?.toBuffer?.()
			if (!Buffer.isBuffer(ctrlBuf) || ctrlBuf.length < 2) return
			const flags2 = ctrlBuf[1] & SEC_CEMI.CTRL2_RELEVANT_MASK

			const dataPart: Buffer = npdu.dataBuffer
				? npdu.dataBuffer.value
				: Buffer.alloc(0)
			if (dataPart.length < 1 + SECURE_SEQ_LEN + 4) return
			const scf = dataPart[0]
			const seq = dataPart.subarray(1, 1 + SECURE_SEQ_LEN)
			const encPayloadAndMac = dataPart.subarray(1 + SECURE_SEQ_LEN)
			const encMac = encPayloadAndMac.subarray(-MAC_LEN_SHORT)
			const encPayload = encPayloadAndMac.subarray(
				0,
				encPayloadAndMac.length - MAC_LEN_SHORT,
			)
			const addrFields = Buffer.from([
				(src >> 8) & 0xff,
				src & 0xff,
				(dst >> 8) & 0xff,
				dst & 0xff,
			])
			const counter0 = Buffer.concat([
				seq,
				addrFields,
				DATA_SECURE_CTR_SUFFIX,
			])
			const [decPayload, macTr] = decryptCtr(
				key,
				counter0,
				encMac,
				encPayload,
			)
			const block0 = Buffer.concat([
				seq,
				addrFields,
				Buffer.from([
					0x00,
					flags2,
					(TPCI_DATA << 2) + APCI_SEC.HIGH,
					APCI_SEC.LOW,
					0x00,
					decPayload.length,
				]),
			])
			const macCbc = calculateMessageAuthenticationCodeCBC(
				key,
				Buffer.from([scf]),
				decPayload,
				block0,
			).subarray(0, MAC_LEN_SHORT)
			if (!macCbc.equals(macTr)) return
			// Rebuild plain NPDU: TPCI=0x00, APCI=second byte, data after first 2 bytes
			npdu.tpci = TPCI_DATA
			if (decPayload.length >= 2) {
				npdu.apci = decPayload[1]
				const rest =
					decPayload.length > 2 ? decPayload.subarray(2) : null
				npdu.data = rest ? new KNXDataBuffer(rest) : null
			} else {
				// Should not happen; fallback
				npdu.apci = 0
				npdu.data = null
			}
		} catch (e) {
			this.sysLogger.error(
				`maybeDecryptDataSecure error: ${(e as Error).message}`,
			)
		}
	}

	// Ensure the provided cEMI message is in plain KNX form before emitting
	// If Data Secure is detected and keys are available, decrypts it in-place.
	private ensurePlainCEMI<T extends CEMIMessage>(cemi: T): T {
		try {
			this.maybeDecryptDataSecure(cemi as any)
		} catch {}
		return cemi
	}

	private sendDescriptionRequestMessage() {
		this.send(
			KNXProtocol.newKNXDescriptionRequest(
				new HPAI(this._options.localIPAddress),
			),
			undefined,
			false,
			this.getSeqNumber(),
		)
	}

	private sendSearchRequestMessage() {
		// For discovery, the HPAI in SEARCH_REQUEST must contain the local
		// control endpoint (IP + local UDP port) to receive unicast responses.
		let localPort = 0
		try {
			const addr: any = this.udpSocket?.address?.()
			if (addr && typeof addr.port === 'number') localPort = addr.port
		} catch {}

		// Plain search request
		this.send(
			KNXProtocol.newKNXSearchRequest(
				new HPAI(
					this._options.localIPAddress,
					localPort || KNX_CONSTANTS.KNX_PORT,
				),
			),
			undefined,
			false,
			this.getSeqNumber(),
		)

		// Secure search request (to detect KNX/IP Secure capable devices)
		try {
			this.send(
				KNXProtocol.newKNXSecureSearchRequest(
					new HPAI(
						this._options.localIPAddress,
						localPort || KNX_CONSTANTS.KNX_PORT,
					),
				),
				undefined,
				false,
				this.getSeqNumber(),
			)
		} catch {}
	}

	private sendSecureSearchRequestTo(host: string, port: number) {
		try {
			const addr: any = this.udpSocket?.address?.()
			const localPort =
				addr && typeof addr.port === 'number'
					? addr.port
					: KNX_CONSTANTS.KNX_PORT
			const frame = KNXProtocol.newKNXSecureSearchRequest(
				new HPAI(this._options.localIPAddress, localPort),
			).toBuffer()
			this.udpSocket?.send(frame, port, host, (error) => {
				if (error) {
					this.sysLogger.error(
						`SecureSearch unicast send error to ${host}:${port}: ${error.message}`,
					)
				}
			})
		} catch (e) {
			this.sysLogger.debug(
				`SecureSearch unicast send skipped for ${host}:${port}: ${(e as Error).message}`,
			)
		}
	}

	private sendConnectRequestMessage(cri: TunnelCRI) {
		// Use NULLHPAI for UDP to match legacy behavior and tests; TCP handled separately
		this.send(
			KNXProtocol.newKNXConnectRequest(
				cri,
				(HPAI as any).NULLHPAI,
				(HPAI as any).NULLHPAI,
			),
			undefined,
			true,
			this.getSeqNumber(),
		)
	}

	private sendConnectionStateRequestMessage(channelID: number) {
		// For TunnelTCP, some gateways expect the control HPAI to indicate TCP (0x02).
		// For UDP/Multicast keep legacy NULLHPAI (UDP 0x01).
		const hpai =
			this._options.hostProtocol === 'TunnelTCP'
				? new HPAI('0.0.0.0', 0, KnxProtocol.IPV4_TCP)
				: (HPAI as any).NULLHPAI
		this.send(
			KNXProtocol.newKNXConnectionStateRequest(channelID, hpai),
			undefined,
			true,
			this.getSeqNumber(),
		)
	}

	private sendDisconnectRequestMessage(channelID: number) {
		// Align HPAI with connection type: use TCP HPAI on TunnelTCP to avoid
		// gateways rejecting the message; keep NULLHPAI for UDP.
		const hpai =
			this._options.hostProtocol === 'TunnelTCP'
				? new HPAI('0.0.0.0', 0, KnxProtocol.IPV4_TCP)
				: (HPAI as any).NULLHPAI
		this.send(
			KNXProtocol.newKNXDisconnectRequest(channelID, hpai),
			undefined,
			true,
			this.getSeqNumber(),
		)
	}

	private sendDisconnectResponseMessage(
		channelID: number,
		status = ConnectionStatus.E_NO_ERROR,
	) {
		this.send(
			KNXProtocol.newKNXDisconnectResponse(channelID, status),
			undefined,
			true,
			this.getSeqNumber(),
		)
	}
}
