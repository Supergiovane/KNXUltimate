import dgram, { RemoteInfo, Socket as UDPSocket } from 'dgram'
import net, { Socket as TCPSocket } from 'net'
import { ConnectionStatus, KNX_CONSTANTS } from './protocol/KNXConstants'
import CEMIConstants from './protocol/cEMI/CEMIConstants'
import CEMIFactory from './protocol/cEMI/CEMIFactory'
import KNXProtocol, { KnxResponse } from './protocol/KNXProtocol'
import KNXConnectResponse from './protocol/KNXConnectResponse'
import HPAI from './protocol/HPAI'
import TunnelCRI, { TunnelTypes } from './protocol/TunnelCRI'
import KNXConnectionStateResponse from './protocol/KNXConnectionStateResponse'
import * as errors from './errors'
import * as ipAddressHelper from './util/ipAddressHelper'
import KNXAddress from './protocol/KNXAddress'
import KNXDataBuffer, { IDataPoint } from './protocol/KNXDataBuffer'
import * as DPTLib from './dptlib'
import KnxLog, { KNXLoggerOptions } from './KnxLog'
import { KNXDescriptionResponse, KNXPacket } from './protocol'
import KNXRoutingIndication from './protocol/KNXRoutingIndication'
import KNXConnectRequest from './protocol/KNXConnectRequest'
import KNXTunnellingRequest from './protocol/KNXTunnellingRequest'
import { TypedEventEmitter } from './TypedEmitter'
import KNXHeader from './protocol/KNXHeader'
import KNXTunnellingAck from './protocol/KNXTunnellingAck'
import KNXSearchResponse from './protocol/KNXSearchResponse'
import KNXDisconnectResponse from './protocol/KNXDisconnectResponse'
import { wait } from './utils'
import { KNX_SECURE } from './secure/SecureConstants'
import KNXSecureTunnelling from './secure/KNXSecureTunnelling'
import SecureWrapper from './secure/messages/SecureWrapper'
import {
	SessionResponse,
	SessionStatus,
} from './secure/messages/SessionMessages'
import { SecureSessionOptions } from './secure/SecureSession'

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
}

export type KNXClientProtocol = 'TunnelUDP' | 'Multicast' | 'TunnelTCP'

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
		packet: KNXTunnellingAck | KNXTunnellingRequest,
		ack: boolean,
	) => void
	close: () => void
	descriptionResponse: (packet: KNXDescriptionResponse) => void
	secureSessionEstablished: () => void
	secureSessionClosed: (reason: string) => void
	secureTunnellingRequest: (req: KNXTunnellingRequest) => void
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
	/** Default: "TunnelUDP". "Multicast" if you're connecting to a KNX Router. "TunnelUDP" for KNX Interfaces */
	hostProtocol?: KNXClientProtocol
	/** Avoid sending/receive the ACK telegram. Leave false. If you encounter issues with old interface, set it to true */
	suppress_ack_ldatareq?: boolean
	/** Leave true forever. This is used only in Node-Red KNX-Ultimate node */
	localEchoInTunnelling?: boolean
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
	secure?: {
		deviceAuthCode: string
		userId: number
		password: string
		serialNumber: number
	}
} & KNXLoggerOptions

const optionsDefaults: KNXClientOptions = {
	physAddr: '15.15.200',
	connectionKeepAliveTimeout: KNX_CONSTANTS.CONNECTION_ALIVE_TIME,
	ipAddr: '224.0.23.12',
	ipPort: 3671,
	hostProtocol: 'Multicast',
	suppress_ack_ldatareq: false,
	loglevel: 'info',
	localEchoInTunnelling: true,
	localIPAddress: '',
	interface: '',
	KNXQueueSendIntervalMilliseconds: 25,
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
	ACK: KNXTunnellingRequest
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

	private sysLogger: any

	private _clearToSend = false

	private socketReady = false

	private timers: Map<KNXTimer, NodeJS.Timeout>

	public physAddr: KNXAddress

	private commandQueue: Array<KNXQueueItem> = []

	private exitProcessingKNXQueueLoop: boolean

	private currentItemHandledByTheQueue: KNXQueueItem

	private queueLock = false

	private sniffingPackets: SnifferPacket[]

	private lastSnifferRequest: number

	private _secureTunnel: KNXSecureTunnelling

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

		this.sysLogger = KnxLog.get({
			loglevel: this._options.loglevel,
		})

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

		if (typeof this._options.physAddr === 'string') {
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

		if (this._options.secure) {
			this.initSecureTunnel()
		}
	}

	private initSecureTunnel() {
		if (!this._options.secure) return

		this._secureTunnel = new KNXSecureTunnelling({
			deviceAuthCode: this._options.secure.deviceAuthCode,
			userId: this._options.secure.userId,
			password: this._options.secure.password,
			serialNumber: this._options.secure.serialNumber,
		})

		// Gestione degli eventi del tunnel sicuro
		this._secureTunnel.on('established', () => {
			this._channelID = this._secureTunnel.getChannelId()
			this._connectionState = ConncetionState.CONNECTED
			this.emit(KNXClientEvents.connected, this._options)
			this.startHeartBeat()
		})

		this._secureTunnel.on('error', (err: Error) => {
			this.sysLogger.error(`Secure tunnel error: ${err.message}`)
			this.emit(KNXClientEvents.error, err)
		})

		this._secureTunnel.on('closed', (reason: string) => {
			this.sysLogger.debug(`Secure tunnel closed: ${reason}`)
			this.setDisconnected(reason)
		})

		this._secureTunnel.on(
			'tunnellingRequest',
			(req: KNXTunnellingRequest) => {
				this.sysLogger.debug(
					`Received secure tunnelling request: ${req.toString()}`,
				)
				this.emit(KNXClientEvents.indication, req, false)
			},
		)

		this._secureTunnel.on('send', (wrapper: SecureWrapper) => {
			this.send(wrapper as any, undefined, true, 0) // Cast to any per compatibilità con il tipo KNXPacket
		})
	}

	private createSocket() {
		if (this._options.hostProtocol === 'TunnelUDP') {
			this._clientSocket = dgram.createSocket({
				type: 'udp4',
				reuseAddr: true,
			}) as UDPSocket
			this.udpSocket.on(
				SocketEvents.message,
				this.processInboundMessage.bind(this),
			)
			this.udpSocket.on(SocketEvents.error, (error) => {
				this.socketReady = false
				this.emit(KNXClientEvents.error, error)
			})

			this.udpSocket.on(SocketEvents.close, () => {
				this.socketReady = false
				this.exitProcessingKNXQueueLoop = true
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
						this.udpSocket.setTTL(5)
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
			// November 2024 - DIRTY function, to be checked
			this._clientSocket = new net.Socket()
			// this._clientSocket.removeAllListeners()
			this.tcpSocket.on(SocketEvents.data, (data) => {
				this.sysLogger.debug('Received message', data)
			})
			this.tcpSocket.on(SocketEvents.error, (error) => {
				this.socketReady = false
				this.emit(KNXClientEvents.error, error)
			})
			this.tcpSocket.on(SocketEvents.close, (hadError) => {
				this.socketReady = false
				this.exitProcessingKNXQueueLoop = true
				this.emit(KNXClientEvents.close)
			})

			this.tcpSocket.on('connect', () => {
				this.socketReady = true
				this.handleKNXQueue()
				this.emit(KNXClientEvents.connected, this._options)
			})
		} else if (this._options.hostProtocol === 'Multicast') {
			this._clientSocket = dgram.createSocket({
				type: 'udp4',
				reuseAddr: true,
			}) as UDPSocket
			// this._clientSocket.removeAllListeners()
			this.udpSocket.on(SocketEvents.listening, () => {
				this.socketReady = true
				this.handleKNXQueue()
			})
			this.udpSocket.on(
				SocketEvents.message,
				this.processInboundMessage.bind(this),
			)
			this.udpSocket.on(SocketEvents.error, (error) => {
				this.socketReady = false
				this.emit(KNXClientEvents.error, error)
			})
			this.udpSocket.on(SocketEvents.close, () => {
				this.socketReady = false
				this.exitProcessingKNXQueueLoop = true
				this.emit(KNXClientEvents.close)
			})

			// The multicast traffic is not sent to a specific local IP, so we cannot set the this._options.localIPAddress in the bind
			// otherwise the socket will never ever receive a packet.
			this.udpSocket.bind(this._peerPort, '0.0.0.0', () => {
				try {
					this.udpSocket.setMulticastTTL(5)
					this.udpSocket.setMulticastInterface(
						this._options.localIPAddress,
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
				} catch (err) {
					this.sysLogger.error(
						'Multicast: cannot add membership (%s)',
						err,
					)
					this.emit(KNXClientEvents.error, err)
				}
			})
		}
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
			new Promise((resolve) => {
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
			if (
				_knxPacket instanceof KNXTunnellingRequest ||
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
					`KNXEngine: <outgoing telegram>: ${sDebugString} `,
				)
			} else if (_knxPacket instanceof KNXTunnellingAck) {
				this.sysLogger.debug(
					`KNXEngine: <outgoing telegram>: ACK ${this.getKNXConstantName(_knxPacket.status)} channelID: ${_knxPacket.channelID} seqCounter: ${_knxPacket.seqCounter}`,
				)
			}

			if (
				this._options.hostProtocol === 'Multicast' ||
				this._options.hostProtocol === 'TunnelUDP'
			) {
				try {
					this.udpSocket.send(
						_knxPacket.toBuffer(),
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
							error.message
						} ${typeof _knxPacket} seqCounter:${
							(_knxPacket as any)?.seqCounter
						}`,
					)
					this.emit(KNXClientEvents.error, error)
					resolve(false)
				}
			} else {
				try {
					this.tcpSocket.write(_knxPacket.toBuffer(), (error) => {
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
						`Sending KNX packet: Send TCP Catch error: ${error.message}` ||
							'Undef error',
					)
					this.emit(KNXClientEvents.error, error)
					resolve(false)
				}
			}
		})
	}

	private async handleKNXQueue() {
		if (this.queueLock) {
			this.sysLogger.debug(
				`KNXClient: handleKNXQueue: HandleQueue has called, but the queue loop is already running. Exit.`,
			)
			return
		}

		this.sysLogger.debug(
			`KNXClient: handleKNXQueue: Start Processing queued KNX. Found ${this.commandQueue.length} telegrams in queue.`,
		)

		// lock the queue
		this.queueLock = true

		// Limiter: limits max telegrams per second
		while (this.commandQueue.length > 0) {
			if (!this.clearToSend) {
				this.sysLogger.debug(
					`KNXClient: handleKNXQueue: Clear to send is false. Pause processing queue.`,
				)
				break
			}

			if (this.exitProcessingKNXQueueLoop) {
				this.sysLogger.debug(
					`KNXClient: handleKNXQueue: exitProcessingKNXQueueLoop is true. Exit processing queue loop`,
				)
				break
			}

			if (this.socketReady === false) {
				this.sysLogger.debug(
					`KNXClient: handleKNXQueue: Socket is not ready. Stop processing queue.`,
				)
				break
			}

			const item = this.commandQueue.pop()
			this.currentItemHandledByTheQueue = item
			if (item.ACK !== undefined) {
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
			`KNXClient: handleKNXQueue: End Processing queued KNX.`,
		)
	}

	/**
	 * Write knxPacket to socket
	 */
	send(
		_knxPacket: KNXPacket,
		_ACK: KNXTunnellingRequest,
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
			`KNXClient: ADDED TELEGRAM TO COMMANDQUEUE. Len: ${this.commandQueue.length}, Priority: ${_priority}`,
			toBeAdded,
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
			// Multicast.
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
			// 06/12/2021 Multivast automaticalli echoes telegrams
		} else {
			// Tunnelling
			const cEMIMessage = CEMIFactory.newLDataRequestMessage(
				'write',
				srcAddress,
				dstAddress,
				knxBuffer,
			)
			// cEMIMessage.control.ack = this._options.suppress_ack_ldatareq ? 0 : 1; // No ack like telegram sent from ETS (0 means don't care)
			cEMIMessage.control.ack = 0 // No ack like telegram sent from ETS (0 means don't care)
			cEMIMessage.control.broadcast = 1
			cEMIMessage.control.priority = 3
			cEMIMessage.control.addressType = 1
			cEMIMessage.control.hopCount = 6
			const seqNum: number = this.incSeqNumber() // 26/12/2021
			const knxPacketRequest = KNXProtocol.newKNXTunnellingRequest(
				this._channelID,
				seqNum,
				cEMIMessage,
			)
			if (!this._options.suppress_ack_ldatareq) {
				this.send(
					knxPacketRequest,
					knxPacketRequest,
					false,
					this.getSeqNumber(),
				)
			} else {
				this.send(
					knxPacketRequest,
					undefined,
					false,
					this.getSeqNumber(),
				)
			}
			// 06/12/2021 Echo the sent telegram. Last parameter is the echo true/false
			if (this._options.localEchoInTunnelling)
				this.emit(KNXClientEvents.indication, knxPacketRequest, true)
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
			// Multicast
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
			// 06/12/2021 Multivast automatically echoes telegrams
		} else {
			// Tunnelling
			const cEMIMessage = CEMIFactory.newLDataRequestMessage(
				'response',
				srcAddress,
				dstAddress,
				knxBuffer,
			)
			// cEMIMessage.control.ack = this._options.suppress_ack_ldatareq ? 0 : 1;
			cEMIMessage.control.ack = 0 // No ack like telegram sent from ETS (0 means don't care)
			cEMIMessage.control.broadcast = 1
			cEMIMessage.control.priority = 3
			cEMIMessage.control.addressType = 1
			cEMIMessage.control.hopCount = 6
			const seqNum: number = this.incSeqNumber() // 26/12/2021
			const knxPacketRequest = KNXProtocol.newKNXTunnellingRequest(
				this._channelID,
				seqNum,
				cEMIMessage,
			)
			if (!this._options.suppress_ack_ldatareq) {
				this.send(
					knxPacketRequest,
					knxPacketRequest,
					false,
					this.getSeqNumber(),
				)
			} else {
				this.send(
					knxPacketRequest,
					undefined,
					false,
					this.getSeqNumber(),
				)
			}
			// 06/12/2021 Echo the sent telegram. Last parameter is the echo true/false
			if (this._options.localEchoInTunnelling)
				this.emit(KNXClientEvents.indication, knxPacketRequest, true)
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
			// Multicast
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
			// 06/12/2021 Multivast automaticalli echoes telegrams
		} else {
			// Tunnelling
			const cEMIMessage = CEMIFactory.newLDataRequestMessage(
				'read',
				srcAddress,
				dstAddress,
				null,
			)
			// cEMIMessage.control.ack = this._options.suppress_ack_ldatareq ? 0 : 1;
			cEMIMessage.control.ack = 0 // No ack like telegram sent from ETS (0 means don't care)
			cEMIMessage.control.broadcast = 1
			cEMIMessage.control.priority = 3
			cEMIMessage.control.addressType = 1
			cEMIMessage.control.hopCount = 6
			const seqNum: number = this.incSeqNumber() // 26/12/2021
			const knxPacketRequest = KNXProtocol.newKNXTunnellingRequest(
				this._channelID,
				seqNum,
				cEMIMessage,
			)
			if (!this._options.suppress_ack_ldatareq) {
				this.send(
					knxPacketRequest,
					knxPacketRequest,
					false,
					this.getSeqNumber(),
				)
			} else {
				this.send(
					knxPacketRequest,
					undefined,
					false,
					this.getSeqNumber(),
				)
			}
			// 06/12/2021 Echo the sent telegram. Last parameter is the echo true/false
			if (this._options.localEchoInTunnelling) {
				this.emit(KNXClientEvents.indication, knxPacketRequest, true)
			}
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
			// Multicast
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
			// 06/12/2021 Multivast automaticalli echoes telegrams
		} else {
			// Tunnelling
			const cEMIMessage = CEMIFactory.newLDataRequestMessage(
				'write',
				srcAddress,
				dstAddress,
				data,
			)
			cEMIMessage.control.ack = this._options.suppress_ack_ldatareq
				? 0
				: 1
			cEMIMessage.control.broadcast = 1
			cEMIMessage.control.priority = 3
			cEMIMessage.control.addressType = 1
			cEMIMessage.control.hopCount = 6
			const seqNum: number = this.incSeqNumber() // 26/12/2021
			const knxPacketRequest = KNXProtocol.newKNXTunnellingRequest(
				this._channelID,
				seqNum,
				cEMIMessage,
			)
			if (!this._options.suppress_ack_ldatareq) {
				this.send(
					knxPacketRequest,
					knxPacketRequest,
					false,
					this.getSeqNumber(),
				)
			} else {
				this.send(
					knxPacketRequest,
					undefined,
					false,
					this.getSeqNumber(),
				)
			}
			// 06/12/2021 Echo the sent telegram. Last parameter is the echo true/false
			if (this._options.localEchoInTunnelling)
				this.emit(KNXClientEvents.indication, knxPacketRequest, true)
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
		this.sendSearchRequestMessage()
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

		const client = new KNXClient({
			interface: eth as string,
			hostProtocol: 'Multicast',
		})

		const discovered: string[] = []

		client.on(KNXClientEvents.discover, (host, header, searchResponse) => {
			discovered.push(host)
		})

		client.startDiscovery()

		await wait(timeout)
		await client.Disconnect()

		return discovered
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
			1000 * KNX_CONSTANTS.SEARCH_TIMEOUT,
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
		ipAddr,
		ipPort,
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

	/**
	 * Connect to the KNX bus.
	 * For secure connections, TCP is required and secure options must be provided
	 */
	Connect(knxLayer = TunnelTypes.TUNNEL_LINKLAYER) {
		if (this._clientSocket === null) {
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

		// Change state and reset counters
		this._connectionState = ConncetionState.CONNECTING
		this._numFailedTelegramACK = 0
		this.clearToSend = true
		this.clearTimer(KNXTimer.CONNECTION)

		// Emit connecting event
		this.emit(KNXClientEvents.connecting, this._options)

		// Handle secure tunneling over TCP
		if (
			this._options.hostProtocol === 'TunnelTCP' &&
			this._options.secure
		) {
			try {
				// Configure TCP socket
				;(this._clientSocket as TCPSocket).connect({
					host: this._peerHost,
					port: this._peerPort,
				})

				// Set connection timeout
				this.setTimer(
					KNXTimer.CONNECTION,
					() => {
						const timeoutError = new Error(
							`Connection timeout to ${this._peerHost}:${this._peerPort}`,
						)
						this.emit(KNXClientEvents.error, timeoutError)
					},
					1000 * KNX_CONSTANTS.CONNECT_REQUEST_TIMEOUT,
				)

				// Initialize secure tunnel when TCP connects
				this._clientSocket.once('connect', () => {
					// Initialize secure tunnel if not already done
					if (!this._secureTunnel) {
						this.initSecureTunnel()
					}

					// Start secure session
					const sessionRequest = this._secureTunnel.connect(knxLayer)
					this.send(sessionRequest, undefined, true, 0)
				})
			} catch (error) {
				this.emit(KNXClientEvents.error, error)
				this._connectionState = ConncetionState.DISCONNECTED
			}
		}
		// Handle UDP tunneling (non-secure)
		else if (this._options.hostProtocol === 'TunnelUDP') {
			// Set connection timeout
			const timeoutError = new Error(
				`Connection timeout to ${this._peerHost}:${this._peerPort}`,
			)
			this.setTimer(
				KNXTimer.CONNECTION,
				() => {
					this.emit(KNXClientEvents.error, timeoutError)
				},
				1000 * KNX_CONSTANTS.CONNECT_REQUEST_TIMEOUT,
			)

			// Reset sequence number and set awaiting response
			this._awaitingResponseType = KNX_CONSTANTS.CONNECT_RESPONSE
			this._clientTunnelSeqNumber = -1

			// Send connect request after a short delay to allow socket binding
			this.setTimer(
				KNXTimer.CONNECT_REQUEST,
				() => {
					const cri = new TunnelCRI(knxLayer)
					this.sendConnectRequestMessage(cri)
				},
				2000,
			)
		}
		// Handle multicast (non-secure)
		else if (this._options.hostProtocol === 'Multicast') {
			// Multicast connections are immediately considered connected
			this._connectionState = ConncetionState.CONNECTED

			// Reset counters
			this._numFailedTelegramACK = 0
			this.clearToSend = true
			this._clientTunnelSeqNumber = -1

			this.emit(KNXClientEvents.connected, this._options)
		} else {
			throw new Error(
				`Unsupported protocol: ${this._options.hostProtocol}`,
			)
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
					// we could try to see if `end()` works well too
					client.destroy()
				} else {
					client.close(cb)
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
		this.exitProcessingKNXQueueLoop = true // Exits KNX processing queue loop
		if (this._clientSocket === null) {
			throw new Error('No client socket defined')
		}

		if (this._connectionState === ConncetionState.DISCONNECTING) {
			throw new Error('Already disconnecting')
		}

		// clear active timers
		this.clearAllTimers()

		this._connectionState = ConncetionState.DISCONNECTING

		// 20/04/2022 this._channelID === null can happen when the KNX Gateway is already disconnected
		if (this._channelID === null) {
			// 11/10/2022 Close the socket
			this.sysLogger.debug(
				`KNXClient: into Disconnect(), channel id is not defined so skip disconnect packet and close socket`,
			)
			await this.closeSocket()
			return
		}

		this._awaitingResponseType = KNX_CONSTANTS.DISCONNECT_RESPONSE
		this.sendDisconnectRequestMessage(this._channelID)

		// wait for disconnect event or at most 2 seconds
		await this.waitForEvent(KNXClientEvents.disconnected, 2000)

		// 12/03/2021 Set disconnected if not already set by DISCONNECT_RESPONSE sent from the IP Interface
		if (this._connectionState !== ConncetionState.DISCONNECTED) {
			this.setDisconnected(
				"Forced call from KNXClient Disconnect() function, because the KNX Interface hasn't sent the DISCONNECT_RESPONSE in time.",
			)
		}

		if (this._options.sniffingMode) {
			console.log('Sniffing mode is enabled. Dumping sniffing buffers...')
			console.log(this.sniffingPackets)
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
			`KNXClient: called _setDisconnected ${this._options.ipAddr}:${this._options.ipPort} ${_sReason}`,
		)
		this._connectionState = ConncetionState.DISCONNECTED

		// clear active timers
		this.clearAllTimers()

		this._clientTunnelSeqNumber = -1
		this._channelID = null

		await this.closeSocket()

		this.emit(
			KNXClientEvents.disconnected,
			`${this._options.ipAddr}:${this._options.ipPort} ${_sReason}`,
		)
		this.clearToSend = true // 26/12/2021 allow to send
	}

	/**
	 * Send a connection state request message to the KNX bus and schedule the next heartbeat
	 */
	private runHeartbeat() {
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
				this.sysLogger.error(
					`KNXClient: getConnectionStatus Timeout ${this._heartbeatFailures} out of ${this.max_HeartbeatFailures}`,
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
	 * Get actual tunnelling sequence number
	 */
	private getSeqNumber() {
		return this._clientTunnelSeqNumber
	}

	private getCurrentItemHandledByTheQueue() {
		return this.currentItemHandledByTheQueue.expectedSeqNumberForACK
	}

	/**
	 * Increment the tunnelling sequence number
	 */
	private incSeqNumber() {
		this._clientTunnelSeqNumber++
		if (this._clientTunnelSeqNumber > 255) {
			this._clientTunnelSeqNumber = 0
		}
		return this._clientTunnelSeqNumber
	}

	/**
	 * Setup a timer while waiting for an ACK of `knxTunnellingRequest`
	 */
	private setTimerWaitingForACK(knxTunnellingRequest: KNXTunnellingRequest) {
		this.clearToSend = false // 26/12/2021 stop sending until ACK received
		const timeoutErr = new errors.RequestTimeoutError(
			`seqCounter:${knxTunnellingRequest.seqCounter}, DestAddr:${
				knxTunnellingRequest.cEMIMessage.dstAddress.toString() ||
				'Non definito'
			},  AckRequested:${
				knxTunnellingRequest.cEMIMessage.control.ack
			}, timed out waiting telegram acknowledge by ${
				this._options.ipAddr || 'No Peer host detected'
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
						knxTunnellingRequest,
						false,
					)
					this.clearToSend = true
					this.emit(KNXClientEvents.error, timeoutErr)
					this.sysLogger.error(
						`KNXClient: _setTimerWaitingForACK: ${
							timeoutErr.message || 'Undef error'
						} no ACK received. ABORT sending datagram with seqNumber ${this.getSeqNumber()} from ${knxTunnellingRequest.cEMIMessage.srcAddress.toString()} to ${knxTunnellingRequest.cEMIMessage.dstAddress.toString()}`,
					)
				} else {
					// 26/12/2021 // If no ACK received, resend the datagram once with the same sequence number
					this.sysLogger.error(
						`KNXClient: _setTimerWaitingForACK: ${
							timeoutErr.message || 'Undef error'
						} no ACK received. Retransmit datagram with seqNumber ${
							this.currentItemHandledByTheQueue
								.expectedSeqNumberForACK
						} from ${knxTunnellingRequest.cEMIMessage.srcAddress.toString()} to ${knxTunnellingRequest.cEMIMessage.dstAddress.toString()}`,
					)
					this.send(
						knxTunnellingRequest,
						knxTunnellingRequest,
						true,
						this.currentItemHandledByTheQueue
							.expectedSeqNumberForACK,
					)
				}
			},
			KNX_CONSTANTS.TUNNELLING_REQUEST_TIMEOUT * 1000,
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
			// Composing debug string
			sProcessInboundLog = `Data received: ${msg.toString('hex')}`
			sProcessInboundLog += ` srcAddress: ${JSON.stringify(rinfo)}`
			this.sysLogger.debug(
				`KNXEngine: processInboundMessage prior to processing: ${sProcessInboundLog} ChannelID:${this._channelID} Host:${this._options.ipAddr}:${this._options.ipPort}`,
			)

			// Handle secure messages if secure mode is enabled
			if (this._options.secure) {
				const { knxHeader, secureMessage } =
					KNXProtocol.parseSecureMessage(msg)

				switch (knxHeader.service_type) {
					case KNX_SECURE.SERVICE_TYPE.SESSION_RESPONSE: {
						const sessionAuth =
							this._secureTunnel.handleSessionResponse(
								secureMessage as SessionResponse,
							)
						if (sessionAuth) {
							this.send(
								sessionAuth,
								undefined,
								true,
								this.getSeqNumber(),
							)
						}
						return
					}

					case KNX_SECURE.SERVICE_TYPE.SESSION_STATUS: {
						this._secureTunnel.handleSessionStatus(
							secureMessage as SessionStatus,
						)
						return
					}

					case KNX_SECURE.SERVICE_TYPE.SECURE_WRAPPER: {
						this._secureTunnel.handleSecureWrapper(
							secureMessage as SecureWrapper,
						)
						return
					}
				}
			}

			// Standard message parsing
			const { knxHeader, knxMessage } = KNXProtocol.parseMessage(msg)

			// Existing debug logging
			sProcessInboundLog = `peerHost:${this._peerHost}:${this._peerPort}`
			sProcessInboundLog += ` srcAddress: ${rinfo?.address}:${rinfo?.port}`
			sProcessInboundLog += ` channelID:${this._channelID === null || this._channelID === undefined ? 'None' : this._channelID}`
			sProcessInboundLog += ` service_type:${this.getKNXConstantName(knxHeader?.service_type)}`
			sProcessInboundLog += ` knxHeader: ${JSON.stringify(knxHeader)} knxMessage: ${JSON.stringify(knxMessage)}`
			sProcessInboundLog += ` raw: ${msg.toString('hex')}`
			this.sysLogger.debug(
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

			if (knxHeader.service_type === KNX_CONSTANTS.SEARCH_RESPONSE) {
				if (!this.isDiscoveryRunning()) return

				this.emit(
					KNXClientEvents.discover,
					`${rinfo.address}:${rinfo.port}`,
					knxHeader,
					knxMessage as KNXSearchResponse,
				)
			} else if (
				knxHeader.service_type === KNX_CONSTANTS.DESCRIPTION_RESPONSE
			) {
				const knxDescriptionResponse =
					knxMessage as KNXDescriptionResponse

				this.sysLogger.debug(
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
					this.emit(KNXClientEvents.connected, this._options)
					this.startHeartBeat()
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
							`Received KNX packet: DISCONNECT_REQUEST, ChannelID:${this._channelID} Host:${this._options.ipAddr}:${this._options.ipPort}`,
						)
					},
					1000,
				)
			} else if (
				knxHeader.service_type === KNX_CONSTANTS.TUNNELLING_REQUEST
			) {
				const knxTunnellingRequest = knxMessage as KNXTunnellingRequest
				if (knxTunnellingRequest.channelID !== this._channelID) {
					this.sysLogger.debug(
						`Received KNX packet: TUNNELLING: L_DATA_IND, NOT FOR ME: MyChannelID:${this._channelID} ReceivedPacketChannelID: ${knxTunnellingRequest.channelID} ReceivedPacketseqCounter:${knxTunnellingRequest.seqCounter} Host:${this._options.ipAddr}:${this._options.ipPort}`,
					)
					return
				}
				try {
					const knxTunnelAck = KNXProtocol.newKNXTunnellingACK(
						knxTunnellingRequest.channelID,
						knxTunnellingRequest.seqCounter,
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
						`Received KNX packet: TUNNELLING: L_DATA_IND, ERROR BUOLDING THE TUNNELINK ACK: ${error.message} MyChannelID:${this._channelID} ReceivedPacketChannelID: ${knxTunnellingRequest.channelID} ReceivedPacketseqCounter:${knxTunnellingRequest.seqCounter} Host:${this._options.ipAddr}:${this._options.ipPort}`,
					)
				}

				if (
					knxTunnellingRequest.cEMIMessage.msgCode ===
					CEMIConstants.L_DATA_IND
				) {
					// Composing debug string
					let sDebugString = `Data: ${JSON.stringify(
						knxTunnellingRequest.cEMIMessage.npdu,
					)}`
					sDebugString += ` srcAddress: ${knxTunnellingRequest.cEMIMessage.srcAddress.toString()}`
					sDebugString += ` dstAddress: ${knxTunnellingRequest.cEMIMessage.dstAddress.toString()}`
					this.sysLogger.debug(
						`Received KNX packet: TUNNELLING: L_DATA_IND, ${sDebugString} ChannelID:${this._channelID} seqCounter:${knxTunnellingRequest.seqCounter} Host:${this._options.ipAddr}:${this._options.ipPort}`,
					)

					this.emit(
						KNXClientEvents.indication,
						knxTunnellingRequest,
						false,
					)
				} else if (
					knxTunnellingRequest.cEMIMessage.msgCode ===
					CEMIConstants.L_DATA_CON
				) {
					this.sysLogger.debug(
						`Received KNX packet: TUNNELLING: L_DATA_CON, ChannelID:${this._channelID} seqCounter:${knxTunnellingRequest.seqCounter} Host:${this._options.ipAddr}:${this._options.ipPort}`,
					)
				}
			} else if (
				knxHeader.service_type === KNX_CONSTANTS.TUNNELLING_ACK
			) {
				const knxTunnellingAck = knxMessage as KNXTunnellingAck
				if (knxTunnellingAck.channelID !== this._channelID) {
					return
				}

				this.sysLogger.debug(
					`Received KNX packet: TUNNELLING: TUNNELLING_ACK, ChannelID:${this._channelID} seqCounter:${knxTunnellingAck.seqCounter} Host:${this._options.ipAddr}:${this._options.ipPort}`,
				)

				// Check the received ACK sequence number
				if (!this._options.suppress_ack_ldatareq) {
					if (
						knxTunnellingAck.seqCounter ===
						this.getCurrentItemHandledByTheQueue()
					) {
						this.clearTimer(KNXTimer.ACK)
						this._numFailedTelegramACK = 0 // 25/12/2021 clear the current ACK failed telegram number
						this.clearToSend = true // I'm ready to send a new datagram now
						// 08/04/2022 Emits the event informing that the last ACK has been acknowledge.
						this.emit(
							KNXClientEvents.ackReceived,
							knxTunnellingAck,
							true,
						)
						this.sysLogger.debug(
							`Received KNX packet: TUNNELLING: DELETED_TUNNELLING_ACK FROM PENDING ACK's, ChannelID:${this._channelID} seqCounter:${knxTunnellingAck.seqCounter} Host:${this._options.ipAddr}:${this._options.ipPort}`,
						)
					} else {
						// Inform that i received an ACK with an unexpected sequence number. It should be handled as error, but for now, only log.
						this.sysLogger.error(
							`Received KNX packet: TUNNELLING: Unexpected Tunnel Ack with seqCounter = ${knxTunnellingAck.seqCounter}, expecting ${this.getSeqNumber()}`,
						)
						// this.emit(KNXClientEvents.error, `Unexpected Tunnel Ack ${knxTunnellingAck.seqCounter}`);
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
					this.emit(KNXClientEvents.indication, knxRoutingInd, false)
				} else if (
					knxRoutingInd.cEMIMessage.msgCode ===
					CEMIConstants.L_DATA_CON
				) {
					this.sysLogger.debug(
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
		this.send(
			KNXProtocol.newKNXSearchRequest(
				new HPAI(this._options.localIPAddress, this._peerPort),
			),
			undefined,
			false,
			this.getSeqNumber(),
			// KNX_CONSTANTS.KNX_PORT,
			// KNX_CONSTANTS.KNX_IP,
		)
	}

	private sendConnectRequestMessage(cri: TunnelCRI) {
		this.send(
			KNXProtocol.newKNXConnectRequest(cri),
			undefined,
			true,
			this.getSeqNumber(),
		)
	}

	private sendConnectionStateRequestMessage(channelID: number) {
		this.send(
			KNXProtocol.newKNXConnectionStateRequest(channelID),
			undefined,
			true,
			this.getSeqNumber(),
		)
	}

	private sendDisconnectRequestMessage(channelID: number) {
		this.send(
			KNXProtocol.newKNXDisconnectRequest(channelID),
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
