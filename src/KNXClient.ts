// Made with love by Supergiovane
import { EventEmitter } from 'events'
import dgram, { RemoteInfo, UFPSocket } from 'dgram'
import net, { Socket as TCPSocket } from 'net'
import { ConnectionStatus, KNX_CONSTANTS } from './protocol/KNXConstants'
import CEMIConstants from './protocol/cEMI/CEMIConstants'
import CEMIFactory from './protocol/cEMI/CEMIFactory'
import KNXProtocol from './protocol/KNXProtocol'
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
import CEMIMessage from './protocol/cEMI/CEMIMessage'
import { Logger } from 'log-driver'
import { KNXPacket } from './protocol'
import KNXRoutingIndication from './protocol/KNXRoutingIndication'
import KNXConnectRequest from './protocol/KNXConnectRequest'
import KNXTunnelingRequest from './protocol/KNXTunnelingRequest'

enum STATE {
	STARTED = 'STARTED',
	CONNECTING = 'CONNECTING',
	CONNECTED = 'CONNECTED',
	DISCONNECTING = 'DISCONNECTING',
	DISCONNECTED = 'DISCONNECTED',
}

enum TUNNELSTATE {
	READY = 'READY',
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
}

const jKNXSecureKeyring: string = ''

export type KNXClientOptions = {
	physAddr: string
	connectionKeepAliveTimeout?: number
	ipAddr: string
	ipPort: number | string
	hostProtocol: KNXClientProtocol
	isSecureKNXEnabled?: boolean
	suppress_ack_ldatareq?: boolean
	localEchoInTunneling?: boolean
	localIPAddress?: string
	interface?: string
	jKNXSecureKeyring?: any
	localSocketAddress?: string
} & KNXLoggerOptions

const optionsDefaults: KNXClientOptions = {
	physAddr: '15.15.200',
	connectionKeepAliveTimeout: KNX_CONSTANTS.CONNECTION_ALIVE_TIME,
	ipAddr: '224.0.23.12',
	ipPort: 3671,
	hostProtocol: 'TunnelUDP',
	isSecureKNXEnabled: false,
	suppress_ack_ldatareq: false,
	loglevel: 'info',
	localEchoInTunneling: true,
	localIPAddress: '',
	interface: '',
	jKNXSecureKeyring: {},
}

export function getDecodedKeyring() {
	return jKNXSecureKeyring
}

export default class KNXClient extends EventEmitter {
	private _channelID: number

	private _connectionState: string

	private _timerWaitingForACK: null | NodeJS.Timeout

	private _numFailedTelegramACK: number

	private _clientTunnelSeqNumber: number

	private _options: KNXClientOptions

	private _peerHost: string

	private _peerPort: number

	private _connectionTimeoutTimer: null | NodeJS.Timeout

	private _heartbeatFailures: number

	private _heartbeatRunning: boolean

	private max_HeartbeatFailures: number

	private _heartbeatTimer: null | NodeJS.Timeout

	private _discovery_timer: null | NodeJS.Timeout

	private _awaitingResponseType: number

	private _clientSocket: UFPSocket | TCPSocket

	private sysLogger: Logger

	private jKNXSecureKeyring: any

	private_heartbeatRunning: boolean

	private_clearToSend: boolean

	private _timerTimeoutSendDisconnectRequestMessage: null | NodeJS.Timeout

	private _clearToSend: boolean

	public physAddr: KNXAddress

	constructor(options: KNXClientOptions) {
		super()

		if (options === undefined) {
			options = optionsDefaults
		} else {
			options = {
				...optionsDefaults,
				...options,
			}
		}
		this._options = options

		this.sysLogger = KnxLog.get({
			loglevel: this._options.loglevel,
		})

		this._channelID = null
		this._connectionState = STATE.DISCONNECTED
		this._timerWaitingForACK = null
		this._numFailedTelegramACK = 0
		this._clientTunnelSeqNumber = -1
		this._options.connectionKeepAliveTimeout =
			KNX_CONSTANTS.CONNECTION_ALIVE_TIME
		this._peerHost = this._options.ipAddr
		this._peerPort = parseInt(this._options.ipPort as string, 10)
		this._options.localSocketAddress = options.localSocketAddress
		this._connectionTimeoutTimer = null
		this._heartbeatFailures = 0
		this.max_HeartbeatFailures = 3
		this._heartbeatTimer = null
		this._discovery_timer = null
		this._awaitingResponseType = null
		this._clientSocket = null
		this.jKNXSecureKeyring = this._options.jKNXSecureKeyring

		// add an error listener otherwise without this
		// the emit error would throw
		this.on('error', (error) => {})

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

		this.removeAllListeners()

		if (this._options.hostProtocol === 'TunnelUDP') {
			this._clientSocket = dgram.createSocket({
				type: 'udp4',
				reuseAddr: false,
			}) as UFPSocket
			this._clientSocket.removeAllListeners()
			this._clientSocket.bind(
				{ port: null, address: this._options.localIPAddress },
				() => {
					try {
						;(this._clientSocket as UFPSocket).setTTL(250)
						if (this._options.localSocketAddress === undefined) {
							this._options.localSocketAddress = (
								this._clientSocket as UFPSocket
							).address().address
						}
					} catch (error) {
						this.sysLogger.error(
							`UDP:  Error setting SetTTL ${error.message}` || '',
						)
					}
				},
			)
			this._clientSocket.on(
				SocketEvents.message,
				this._processInboundMessage.bind(this),
			)
			this._clientSocket.on(SocketEvents.error, (error) =>
				this.emit(KNXClientEvents.error, error),
			)
			this._clientSocket.on(SocketEvents.close, () =>
				this.emit(KNXClientEvents.close),
			)
		} else if (this._options.hostProtocol === 'TunnelTCP') {
			this._clientSocket = new net.Socket()
			this._clientSocket.removeAllListeners()
			this._clientSocket.on(SocketEvents.data, (data) => {
				console.log('Received message', data)
			})
			this._clientSocket.on(SocketEvents.error, (error) =>
				this.emit(KNXClientEvents.error, error),
			)
			this._clientSocket.on(SocketEvents.close, (hadError) =>
				this.emit(KNXClientEvents.close),
			)
		} else if (this._options.hostProtocol === 'Multicast') {
			this._clientSocket = dgram.createSocket({
				type: 'udp4',
				reuseAddr: true,
			}) as UFPSocket
			this._clientSocket.removeAllListeners()
			this._clientSocket.on(SocketEvents.listening, () => {})
			this._clientSocket.on(
				SocketEvents.message,
				this._processInboundMessage.bind(this),
			)
			this._clientSocket.on(SocketEvents.error, (error) =>
				this.emit(KNXClientEvents.error, error),
			)
			this._clientSocket.on('close', () =>
				this.emit(KNXClientEvents.close),
			)
			this._clientSocket.bind(this._peerPort, () => {
				const client = this._clientSocket as UFPSocket
				try {
					client.setMulticastTTL(250)
					client.setMulticastInterface(this._options.localIPAddress)
				} catch (error) {
					this.sysLogger.error(
						`Multicast: Error setting SetTTL ${error.message}` ||
							'',
					)
				}
				try {
					client.addMembership(
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

	get channelID() {
		return this._channelID
	}

	getKNXDataBuffer(_data: Buffer, _dptid: string) {
		const adpu = {} as DPTLib.APDU
		DPTLib.populateAPDU(_data, adpu, _dptid)
		const iDatapointType: number = parseInt(
			_dptid.substr(0, _dptid.indexOf('.')),
		)
		const isSixBits: boolean = adpu.bitlength <= 6

		this.sysLogger.trace(
			`isSixBits:${isSixBits} Includes (should be = isSixBits):${[
				1, 2, 3, 5, 9, 10, 11, 14, 18,
			].includes(iDatapointType)} ADPU BitLenght:${adpu.bitlength}`,
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

	send(knxPacket: KNXPacket): void {
		if (knxPacket instanceof KNXConnectRequest) {
			this.sysLogger.debug(
				`Sending KNX packet: ${knxPacket.constructor.name} Host:${this._peerHost}:${this._peerPort}`,
			)
		}
		if (
			knxPacket instanceof KNXTunnelingRequest ||
			knxPacket instanceof KNXRoutingIndication
		) {
			let sTPCI = ''
			if (knxPacket.cEMIMessage.npdu.isGroupRead) {
				sTPCI = 'Read'
			}
			if (knxPacket.cEMIMessage.npdu.isGroupResponse) {
				sTPCI = 'Response'
			}
			if (knxPacket.cEMIMessage.npdu.isGroupWrite) {
				sTPCI = 'Write'
			}

			let sDebugString = `Data: ${JSON.stringify(knxPacket.cEMIMessage.npdu)}`
			sDebugString += ` srcAddress: ${knxPacket.cEMIMessage.srcAddress.toString()}`
			sDebugString += ` dstAddress: ${knxPacket.cEMIMessage.dstAddress.toString()}`

			this.sysLogger.debug(
				`Sending KNX packet: ${
					knxPacket.constructor.name
				} ${sDebugString} Host:${this._peerHost}:${
					this._peerPort
				} channelID:${(knxPacket as KNXTunnelingRequest).channelID} seqCounter:${
					(knxPacket as KNXTunnelingRequest).seqCounter
				} Dest:${knxPacket.cEMIMessage.dstAddress.toString()}`,
				` Data:${knxPacket.cEMIMessage.npdu.dataValue.toString(
					'hex',
				)} TPCI:${sTPCI}`,
			)
		}

		if (
			this._options.hostProtocol === 'Multicast' ||
			this._options.hostProtocol === 'TunnelUDP'
		) {
			try {
				;(this._clientSocket as UFPSocket).send(
					knxPacket.toBuffer(),
					this._peerPort,
					this._peerHost,
					(err) => {
						if (err) {
							this.sysLogger.error(
								`Sending KNX packet: Send UDP sending error: ${err.message}`,
							)
							this.emit(KNXClientEvents.error, err)
						}
					},
				)
			} catch (error) {
				this.sysLogger.error(
					`Sending KNX packet: Send UDP Catch error: ${
						error.message
					} ${typeof knxPacket} seqCounter:${
						(knxPacket as any).seqCounter || ''
					}`,
				)
				this.emit(KNXClientEvents.error, error)
			}
		} else {
			try {
				;(this._clientSocket as TCPSocket).write(
					knxPacket.toBuffer(),
					(err) => {
						if (err) {
							this.sysLogger.error(
								`Sending KNX packet: Send TCP sending error: ${err.message}` ||
									'Undef error',
							)
							this.emit(KNXClientEvents.error, err)
						}
					},
				)
			} catch (error) {
				this.sysLogger.error(
					`Sending KNX packet: Send TCP Catch error: ${error.message}` ||
						'Undef error',
				)
				this.emit(KNXClientEvents.error, error)
			}
		}
	}

	// sendWriteRequest(dstAddress, data) {
	write(dstAddress: KNXAddress | string, data: any, dptid: any): void {
		if (this._connectionState !== STATE.CONNECTED)
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
			this.send(knxPacketRequest)
			// 06/12/2021 Multivast automaticalli echoes telegrams
		} else {
			// Tunneling
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
			const seqNum: number = this._incSeqNumber() // 26/12/2021
			const knxPacketRequest = KNXProtocol.newKNXTunnelingRequest(
				this._channelID,
				seqNum,
				cEMIMessage,
			)
			if (!this._options.suppress_ack_ldatareq)
				this._setTimerWaitingForACK(knxPacketRequest)
			this.send(knxPacketRequest)
			// 06/12/2021 Echo the sent telegram. Last parameter is the echo true/false
			if (this._options.localEchoInTunneling)
				this.emit(KNXClientEvents.indication, knxPacketRequest, true)
		}
	}

	// sendResponseRequest
	respond(dstAddress: KNXAddress | string, data: Buffer, dptid: any): void {
		if (this._connectionState !== STATE.CONNECTED)
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
			this.send(knxPacketRequest)
			// 06/12/2021 Multivast automaticalli echoes telegrams
		} else {
			// Tunneling
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
			const seqNum: number = this._incSeqNumber() // 26/12/2021
			const knxPacketRequest = KNXProtocol.newKNXTunnelingRequest(
				this._channelID,
				seqNum,
				cEMIMessage,
			)
			if (!this._options.suppress_ack_ldatareq)
				this._setTimerWaitingForACK(knxPacketRequest)
			this.send(knxPacketRequest)
			// 06/12/2021 Echo the sent telegram. Last parameter is the echo true/false
			if (this._options.localEchoInTunneling)
				this.emit(KNXClientEvents.indication, knxPacketRequest, true)
		}
	}

	// sendReadRequest
	read(dstAddress: KNXAddress | string): void {
		if (this._connectionState !== STATE.CONNECTED)
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
			this.send(knxPacketRequest)
			// 06/12/2021 Multivast automaticalli echoes telegrams
		} else {
			// Tunneling
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
			const seqNum: number = this._incSeqNumber() // 26/12/2021
			const knxPacketRequest = KNXProtocol.newKNXTunnelingRequest(
				this._channelID,
				seqNum,
				cEMIMessage,
			)
			if (!this._options.suppress_ack_ldatareq)
				this._setTimerWaitingForACK(knxPacketRequest)
			this.send(knxPacketRequest)
			// 06/12/2021 Echo the sent telegram. Last parameter is the echo true/false
			if (this._options.localEchoInTunneling)
				this.emit(KNXClientEvents.indication, knxPacketRequest, true)
		}
	}

	writeRaw(
		dstAddress: KNXAddress | string,
		_rawDataBuffer: Buffer,
		bitlength: number,
	): void {
		// bitlength is unused and only for backward compatibility

		if (this._connectionState !== STATE.CONNECTED)
			throw new Error(
				'The socket is not connected. Unable to access the KNX BUS',
			)

		if (!Buffer.isBuffer(_rawDataBuffer)) {
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
		const baseBufferFromBitLenght: Buffer = Buffer.alloc(bitlength / 8) // The buffer lenght must be like specified by bitlenght
		_rawDataBuffer.copy(baseBufferFromBitLenght, 0)
		const data: KNXDataBuffer = new KNXDataBuffer(
			baseBufferFromBitLenght,
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
			this.send(knxPacketRequest)
			// 06/12/2021 Multivast automaticalli echoes telegrams
		} else {
			// Tunneling
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
			const seqNum: number = this._incSeqNumber() // 26/12/2021
			const knxPacketRequest = KNXProtocol.newKNXTunnelingRequest(
				this._channelID,
				seqNum,
				cEMIMessage,
			)
			if (!this._options.suppress_ack_ldatareq)
				this._setTimerWaitingForACK(knxPacketRequest)
			this.send(knxPacketRequest)
			// 06/12/2021 Echo the sent telegram. Last parameter is the echo true/false
			if (this._options.localEchoInTunneling)
				this.emit(KNXClientEvents.indication, knxPacketRequest, true)
		}
	}

	startHeartBeat(): void {
		this.stopHeartBeat()
		this._heartbeatFailures = 0
		this._heartbeatRunning = true
		this._runHeartbeat()
	}

	stopHeartBeat(): void {
		if (this._heartbeatTimer !== null) {
			this._heartbeatRunning = false
			clearTimeout(this._heartbeatTimer)
		}
	}

	// isDiscoveryRunning() {
	//     return this._discovery_timer != null;
	// }
	// startDiscovery() {
	//     if (this.isDiscoveryRunning()) {
	//         throw new Error('Discovery already running');
	//     }
	//     this._discovery_timer = setTimeout(() => {
	//         this._discovery_timer = null;
	//     }, 1000 * KNX_CONSTANTS.SEARCH_TIMEOUT);
	//     this._sendSearchRequestMessage();
	// }
	// stopDiscovery() {
	//     if (!this.isDiscoveryRunning()) {
	//         return;
	//     }
	//     if (this._discovery_timer !== null) clearTimeout(this._discovery_timer);
	//     this._discovery_timer = null;
	// }
	// getDescription(host, port) {
	//     if (this._clientSocket == null) {
	//         throw new Error('No client socket defined');
	//     }
	//     this._connectionTimeoutTimer = setTimeout(() => {
	//         this._connectionTimeoutTimer = null;
	//     }, 1000 * KNX_CONSTANTS.DEVICE_CONFIGURATION_REQUEST_TIMEOUT);
	//     this._awaitingResponseType = KNX_CONSTANTS.DESCRIPTION_RESPONSE;
	//     this._sendDescriptionRequestMessage(host, port);
	// }
	Connect(knxLayer = TunnelTypes.TUNNEL_LINKLAYER) {
		if (this._clientSocket == null) {
			throw new Error('No client socket defined')
		}
		if (this._connectionState === STATE.DISCONNECTING) {
			throw new Error(
				'Socket is disconnecting. Please wait until disconnected.',
			)
		}
		if (this._connectionState === STATE.CONNECTING) {
			throw new Error(
				'Socket is connecting. Please wait until connected.',
			)
		}
		if (this._connectionState === STATE.CONNECTED) {
			throw new Error('Socket is already connected. Disconnect first.')
		}

		this._connectionState = STATE.CONNECTING
		this._numFailedTelegramACK = 0 // 25/12/2021 Reset the failed ACK counter
		this._clearToSend = true // 26/12/2021 allow to send

		if (this._connectionTimeoutTimer !== null)
			clearTimeout(this._connectionTimeoutTimer)

		// Emit connecting
		this.emit(KNXClientEvents.connecting, this._options)

		if (this._options.hostProtocol === 'TunnelUDP') {
			// Unicast, need to explicitly create the connection
			const timeoutError = new Error(
				`Connection timeout to ${this._peerHost}:${this._peerPort}`,
			)
			this._connectionTimeoutTimer = setTimeout(() => {
				this._connectionTimeoutTimer = null
				this.emit(KNXClientEvents.error, timeoutError)
			}, 1000 * KNX_CONSTANTS.CONNECT_REQUEST_TIMEOUT)
			this._awaitingResponseType = KNX_CONSTANTS.CONNECT_RESPONSE
			this._clientTunnelSeqNumber = -1
			// 27/06/2023, leave some time to the dgram, do do the bind and read local ip and local port
			const t = setTimeout(() => {
				this._sendConnectRequestMessage(new TunnelCRI(knxLayer))
			}, 2000)
		} else if (this._options.hostProtocol === 'TunnelTCP') {
			// TCP
			const timeoutError = new Error(
				`Connection timeout to ${this._peerHost}:${this._peerPort}`,
			)
			this._clientSocket.connect(this._peerPort, this._peerHost, () => {
				// this._timer = setTimeout(() => {
				//     this._timer = null;
				//     this.emit(KNXClientEvents.error, timeoutError);
				// }, 1000 * KNX_CONSTANTS.CONNECT_REQUEST_TIMEOUT);
				this._awaitingResponseType = KNX_CONSTANTS.CONNECT_RESPONSE
				this._clientTunnelSeqNumber = 0
				if (this._options.isSecureKNXEnabled)
					this._sendSecureSessionRequestMessage(
						new TunnelCRI(knxLayer),
					)
			})
		} else {
			// Multicast
			this._connectionState = STATE.CONNECTED

			// 16/03/2022 These two are referring to tunneling connection, but i set it here as well. Non si sa mai.
			this._numFailedTelegramACK = 0 // 25/12/2021 Reset the failed ACK counter
			this._clearToSend = true // 26/12/2021 allow to send

			this._clientTunnelSeqNumber = -1
			this.emit(KNXClientEvents.connected, this._options)
		}
	}

	getConnectionStatus() {
		if (this._clientSocket == null) {
			throw new Error('No client socket defined')
		}
		const timeoutError = new Error(
			`HeartBeat failure with ${this._peerHost}:${this._peerPort}`,
		)
		const deadError = new Error(
			`Connection dead with ${this._peerHost}:${this._peerPort}`,
		)
		this._heartbeatTimer = setTimeout(() => {
			this._heartbeatTimer = null
			this.sysLogger.error(
				`KNXClient: getConnectionStatus Timeout ${this._heartbeatFailures} out of ${this.max_HeartbeatFailures}`,
			)
			// this.emit(KNXClientEvents.error, timeoutError);

			this._heartbeatFailures++
			if (this._heartbeatFailures >= this.max_HeartbeatFailures) {
				this._heartbeatFailures = 0
				this.emit(KNXClientEvents.error, deadError)
				this._setDisconnected(deadError.message)
			}
		}, 1000 * KNX_CONSTANTS.CONNECTIONSTATE_REQUEST_TIMEOUT)
		this._awaitingResponseType = KNX_CONSTANTS.CONNECTIONSTATE_RESPONSE
		this._sendConnectionStateRequestMessage(this._channelID)
	}

	private async closeSocket() {
		return new Promise<void>((resolve, reject) => {
			// already closed
			if (!this._clientSocket) return

			const cb = (error?) => {
				if (error) {
					reject(error)
				} else {
					this._clientSocket = null
					resolve()
				}
			}

			if (this._clientSocket instanceof UFPSocket) {
				this._clientSocket.close(cb)
			} else {
				this._clientSocket.end(cb)
			}
		})
	}

	Disconnect() {
		if (this._clientSocket === null) {
			throw new Error('No client socket defined')
		}
		// 20/04/2022 this._channelID === null can happen when the KNX Gateway is already disconnected
		if (this._channelID === null) {
			// 11/10/2022 Close the socket
			try {
				// TODO: this should be awaited
				this.closeSocket()
			} catch (error) {
				this.sysLogger.debug(
					`KNXClient: into Disconnect(), this._clientSocket.close(): ${this._options.ipAddr}:${this._options.ipPort} ${error.message}`,
				)
			}
			// TODO: not sure this is correct
			throw new Error('KNX Socket is already disconnected')
		}
		this.stopHeartBeat()
		this._connectionState = STATE.DISCONNECTING
		this._awaitingResponseType = KNX_CONSTANTS.DISCONNECT_RESPONSE
		this._sendDisconnectRequestMessage(this._channelID)

		// 12/03/2021 Set disconnected if not already set by DISCONNECT_RESPONSE sent from the IP Interface
		const t = setTimeout(() => {
			// 21/03/2022 fixed possible memory leak. Previously was setTimeout without "let t = ".
			if (this._connectionState !== STATE.DISCONNECTED)
				this._setDisconnected(
					"Forced call from KNXClient Disconnect() function, because the KNX Interface hasn't sent the DISCONNECT_RESPONSE in time.",
				)
		}, 2000)
	}

	isConnected() {
		return this._connectionState === STATE.CONNECTED
	}

	_setDisconnected(_sReason = '') {
		this.sysLogger.debug(
			`KNXClient: called _setDisconnected ${this._options.ipAddr}:${this._options.ipPort} ${_sReason}`,
		)
		this._connectionState = STATE.DISCONNECTED
		this.stopHeartBeat()
		this._timerTimeoutSendDisconnectRequestMessage = null
		if (this._connectionTimeoutTimer !== null)
			clearTimeout(this._connectionTimeoutTimer)
		if (this._timerWaitingForACK !== null)
			clearTimeout(this._timerWaitingForACK)
		this._clientTunnelSeqNumber = -1
		this._channelID = null

		// 08/12/2021
		// TODO: this should be awaited
		this.closeSocket()

		this.emit(
			KNXClientEvents.disconnected,
			`${this._options.ipAddr}:${this._options.ipPort} ${_sReason}`,
		)
		this._clearToSend = true // 26/12/2021 allow to send
	}

	_runHeartbeat() {
		if (this._heartbeatRunning) {
			this.getConnectionStatus()
			const t = setTimeout(() => {
				// 21/03/2022 fixed possible memory leak. Previously was setTimeout without "let t = ".
				this._runHeartbeat()
			}, 1000 * this._options.connectionKeepAliveTimeout)
		}
	}

	_getSeqNumber() {
		return this._clientTunnelSeqNumber
	}

	// 26/12/2021 Handle the busy state, for example while waiting for ACK
	_getClearToSend() {
		return this._clearToSend !== undefined ? this._clearToSend : true
	}

	_incSeqNumber() {
		this._clientTunnelSeqNumber++
		if (this._clientTunnelSeqNumber > 255) {
			this._clientTunnelSeqNumber = 0
		}
		return this._clientTunnelSeqNumber
	}

	// _keyFromCEMIMessage(cEMIMessage) {
	//     return cEMIMessage.dstAddress.toString();
	// }
	_setTimerWaitingForACK(knxTunnelingRequest: KNXTunnelingRequest) {
		this._clearToSend = false // 26/12/2021 stop sending until ACK received
		const timeoutErr = new errors.RequestTimeoutError(
			`seqCounter:${knxTunnelingRequest.seqCounter}, DestAddr:${
				knxTunnelingRequest.cEMIMessage.dstAddress.toString() ||
				'Non definito'
			},  AckRequested:${
				knxTunnelingRequest.cEMIMessage.control.ack
			}, timed out waiting telegram acknowledge by ${
				this._options.ipAddr || 'No Peer host detected'
			}`,
		)
		if (this._timerWaitingForACK !== null)
			clearTimeout(this._timerWaitingForACK)
		this._timerWaitingForACK = setTimeout(() => {
			this._numFailedTelegramACK += 1
			if (this._numFailedTelegramACK > 2) {
				this._numFailedTelegramACK = 0
				// 08/04/2022 Emits the event informing that the last ACK has not been acknowledge.
				this.emit(
					KNXClientEvents.ackReceived,
					knxTunnelingRequest,
					false,
				)
				this._clearToSend = true
				this.emit(KNXClientEvents.error, timeoutErr)
				this.sysLogger.error(
					`KNXClient: _setTimerWaitingForACK: ${
						timeoutErr.message || 'Undef error'
					} no ACK received. ABORT sending datagram with seqNumber ${this._getSeqNumber()} from ${knxTunnelingRequest.cEMIMessage.srcAddress.toString()} to ${knxTunnelingRequest.cEMIMessage.dstAddress.toString()}`,
				)
			} else {
				// 26/12/2021 // If no ACK received, resend the datagram once with the same sequence number
				this._setTimerWaitingForACK(knxTunnelingRequest)
				this.send(knxTunnelingRequest)
				this.sysLogger.error(
					`KNXClient: _setTimerWaitingForACK: ${
						timeoutErr.message || 'Undef error'
					} no ACK received. Retransmit datagram with seqNumber ${this._getSeqNumber()} from ${knxTunnelingRequest.cEMIMessage.srcAddress.toString()} to ${knxTunnelingRequest.cEMIMessage.dstAddress.toString()}`,
				)
			}
		}, KNX_CONSTANTS.TUNNELING_REQUEST_TIMEOUT * 1000)
	}

	_processInboundMessage(msg: Buffer, rinfo: RemoteInfo) {
		let sProcessInboundLog = ''

		try {
			// Composing debug string
			sProcessInboundLog = `Data received: ${msg.toString('hex')}`
			sProcessInboundLog += ` srcAddress: ${JSON.stringify(rinfo)}`
			this.sysLogger.trace(
				`Received KNX packet: _processInboundMessage, ${sProcessInboundLog} ChannelID:${this._channelID}` ||
					`??` +
						` Host:${this._options.ipAddr}:${this._options.ipPort}`,
			)

			// BUGFIXING https://github.com/Supergiovane/node-red-contrib-knx-ultimate/issues/162
			// msg = Buffer.from("0610053000102900b06011fe11150080","hex");

			const { knxHeader, knxMessage } = KNXProtocol.parseMessage(msg)

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
				if (this._discovery_timer == null) {
					return
				}
				this.emit(
					KNXClientEvents.discover,
					`${rinfo.address}:${rinfo.port}`,
					knxHeader,
					knxMessage,
				)
			} else if (
				knxHeader.service_type === KNX_CONSTANTS.CONNECT_RESPONSE
			) {
				if (this._connectionState === STATE.CONNECTING) {
					if (this._connectionTimeoutTimer !== null)
						clearTimeout(this._connectionTimeoutTimer)
					this._connectionTimeoutTimer = null
					const knxConnectResponse = knxMessage
					if (
						knxConnectResponse.status !==
						ConnectionStatus.E_NO_ERROR
					) {
						this.emit(
							KNXClientEvents.error,
							KNXConnectResponse.statusToString(
								knxConnectResponse.status,
							),
						)
						this._setDisconnected(
							`Connect response error ${knxConnectResponse.status}`,
						)
						return
					}

					// 16/03/2022
					if (this._timerWaitingForACK !== null)
						clearTimeout(this._timerWaitingForACK)

					this._channelID = knxConnectResponse.channelID
					this._connectionState = STATE.CONNECTED
					this._numFailedTelegramACK = 0 // 16/03/2022 Reset the failed ACK counter
					this._clearToSend = true // 16/03/2022 allow to send

					this.sysLogger.debug(
						`Received KNX packet: CONNECT_RESPONSE, ChannelID:${this._channelID} Host:${this._options.ipAddr}:${this._options.ipPort}`,
					)

					this.emit(KNXClientEvents.connected, this._options)
					this.startHeartBeat()
				}
			} else if (
				knxHeader.service_type === KNX_CONSTANTS.DISCONNECT_RESPONSE
			) {
				this.sysLogger.debug(
					`Received KNX packet: DISCONNECT_RESPONSE, ChannelID:${this._channelID} Host:${this._options.ipAddr}:${this._options.ipPort}`,
				)

				if (this._connectionState !== STATE.DISCONNECTING) {
					this.emit(
						KNXClientEvents.error,
						new Error('Unexpected Disconnect Response.'),
					)
				}
				this._setDisconnected(
					'Received DISCONNECT_RESPONSE from the KNX interface.',
				)
			} else if (
				knxHeader.service_type === KNX_CONSTANTS.DISCONNECT_REQUEST
			) {
				const knxDisconnectRequest = knxMessage
				if (knxDisconnectRequest.channelID !== this._channelID) {
					return
				}

				this.sysLogger.error(
					`Received KNX packet: DISCONNECT_REQUEST, ChannelID:${this._channelID} Host:${this._options.ipAddr}:${this._options.ipPort}`,
				)

				this._connectionState = STATE.DISCONNECTING
				this._sendDisconnectResponseMessage(
					knxDisconnectRequest.channelID,
				)

				// 12/03/2021 Added 1 sec delay.
				const t = setTimeout(() => {
					// 21/03/2022 fixed possible memory leak. Previously was setTimeout without "let t = ".
					this._setDisconnected(
						`Received KNX packet: DISCONNECT_REQUEST, ChannelID:${this._channelID} Host:${this._options.ipAddr}:${this._options.ipPort}`,
					)
				}, 1000)
			} else if (
				knxHeader.service_type === KNX_CONSTANTS.TUNNELING_REQUEST
			) {
				const knxTunnelingRequest = knxMessage
				if (knxTunnelingRequest.channelID !== this._channelID) {
					this.sysLogger.debug(
						`Received KNX packet: TUNNELING: L_DATA_IND, NOT FOR ME: MyChannelID:${this._channelID} ReceivedPacketChannelID: ${knxTunnelingRequest.channelID} ReceivedPacketseqCounter:${knxTunnelingRequest.seqCounter} Host:${this._options.ipAddr}:${this._options.ipPort}`,
					)
					return
				}
				// 26/12/2021 send the ACK if the server requestet that
				// Then REMOVED, because some interfaces sets the "ack request" always to 0 even if it needs ack.
				// if (knxMessage.cEMIMessage.control.ack){
				// setTimeout(() => {
				try {
					const knxTunnelAck = KNXProtocol.newKNXTunnelingACK(
						knxTunnelingRequest.channelID,
						knxTunnelingRequest.seqCounter,
						KNX_CONSTANTS.E_NO_ERROR,
					)
					this.send(knxTunnelAck)
				} catch (error) {
					this.sysLogger.error(
						`Received KNX packet: TUNNELING: L_DATA_IND, ERROR BUOLDING THE TUNNELINK ACK: ${error.message} MyChannelID:${this._channelID} ReceivedPacketChannelID: ${knxTunnelingRequest.channelID} ReceivedPacketseqCounter:${knxTunnelingRequest.seqCounter} Host:${this._options.ipAddr}:${this._options.ipPort}`,
					)
				}

				// }, 20);

				// }

				if (
					knxTunnelingRequest.cEMIMessage.msgCode ===
					CEMIConstants.L_DATA_IND
				) {
					// Composing debug string
					let sDebugString = `Data: ${JSON.stringify(
						knxTunnelingRequest.cEMIMessage.npdu,
					)}`
					sDebugString += ` srcAddress: ${knxTunnelingRequest.cEMIMessage.srcAddress.toString()}`
					sDebugString += ` dstAddress: ${knxTunnelingRequest.cEMIMessage.dstAddress.toString()}`
					this.sysLogger.debug(
						`Received KNX packet: TUNNELING: L_DATA_IND, ${sDebugString} ChannelID:${this._channelID} seqCounter:${knxTunnelingRequest.seqCounter} Host:${this._options.ipAddr}:${this._options.ipPort}`,
					)

					this.emit(
						KNXClientEvents.indication,
						knxTunnelingRequest,
						false,
					)
				} else if (
					knxTunnelingRequest.cEMIMessage.msgCode ===
					CEMIConstants.L_DATA_CON
				) {
					this.sysLogger.debug(
						`Received KNX packet: TUNNELING: L_DATA_CON, ChannelID:${this._channelID} seqCounter:${knxTunnelingRequest.seqCounter} Host:${this._options.ipAddr}:${this._options.ipPort}`,
					)
				}
			} else if (knxHeader.service_type === KNX_CONSTANTS.TUNNELING_ACK) {
				const knxTunnelingAck = knxMessage
				if (knxTunnelingAck.channelID !== this._channelID) {
					return
				}

				this.sysLogger.debug(
					`Received KNX packet: TUNNELING: TUNNELING_ACK, ChannelID:${this._channelID} seqCounter:${knxTunnelingAck.seqCounter} Host:${this._options.ipAddr}:${this._options.ipPort}`,
				)

				// Check the received ACK sequence number
				if (!this._options.suppress_ack_ldatareq) {
					if (knxTunnelingAck.seqCounter === this._getSeqNumber()) {
						if (this._timerWaitingForACK !== null)
							clearTimeout(this._timerWaitingForACK)
						this._numFailedTelegramACK = 0 // 25/12/2021 clear the current ACK failed telegram number
						this._clearToSend = true // I'm ready to send a new datagram now
						// 08/04/2022 Emits the event informing that the last ACK has been acknowledge.
						this.emit(KNXClientEvents.ackReceived, knxMessage, true)

						this.sysLogger.debug(
							`Received KNX packet: TUNNELING: DELETED_TUNNELING_ACK FROM PENDING ACK's, ChannelID:${this._channelID} seqCounter:${knxTunnelingAck.seqCounter} Host:${this._options.ipAddr}:${this._options.ipPort}`,
						)
					} else {
						// Inform that i received an ACK with an unexpected sequence number

						this.sysLogger.error(
							`Received KNX packet: TUNNELING: Unexpected Tunnel Ack with seqCounter = ${knxTunnelingAck.seqCounter}`,
						)
						// this.emit(KNXClientEvents.error, `Unexpected Tunnel Ack ${knxTunnelingAck.seqCounter}`);
					}
				}
			} else if (
				knxHeader.service_type === KNX_CONSTANTS.ROUTING_INDICATION
			) {
				// 07/12/2021 Multicast routing indication
				const knxRoutingInd = knxMessage
				if (
					knxRoutingInd.cEMIMessage.msgCode ===
					CEMIConstants.L_DATA_IND
				) {
					// Composing debug string

					let sDebugString = '???'
					sDebugString = `Data: ${JSON.stringify(
						knxRoutingInd.cEMIMessage.npdu,
					)}`
					sDebugString += ` srcAddress: ${knxRoutingInd.cEMIMessage.srcAddress.toString()}`
					sDebugString += ` dstAddress: ${knxRoutingInd.cEMIMessage.dstAddress.toString()}`
					this.sysLogger.debug(
						`Received KNX packet: ROUTING: L_DATA_IND, ${sDebugString} Host:${this._options.ipAddr}:${this._options.ipPort}`,
					)

					this.emit(KNXClientEvents.indication, knxRoutingInd, false)
				} else if (
					knxRoutingInd.cEMIMessage.msgCode ===
					CEMIConstants.L_DATA_CON
				) {
					this.sysLogger.debug(
						`Received KNX packet: ROUTING: L_DATA_CON, Host:${this._options.ipAddr}:${this._options.ipPort}`,
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

						const knxConnectionStateResponse = knxMessage
						if (
							knxConnectionStateResponse.status !==
							KNX_CONSTANTS.E_NO_ERROR
						) {
							this.emit(
								KNXClientEvents.error,
								KNXConnectionStateResponse.statusToString(
									knxConnectionStateResponse.status,
								),
							)
							this._setDisconnected(
								`Awaiting response ${this._awaitingResponseType}, received connection state response  with status ${knxConnectionStateResponse.status}`,
							)
						} else {
							if (this._heartbeatTimer !== null)
								clearTimeout(this._heartbeatTimer)
							this._heartbeatFailures = 0
						}
					} else if (this._connectionTimeoutTimer !== null)
						clearTimeout(this._connectionTimeoutTimer)
				}
				this.emit(
					KNXClientEvents.response,
					`${rinfo.address}:${rinfo.port}`,
					knxHeader,
					knxMessage,
				)
			}
		} catch (e) {
			this.sysLogger.error(
				`Received KNX packet: Error processing inbound message: ${e.message} ${sProcessInboundLog} ChannelID:${this._channelID} Host:${this._options.ipAddr}:${this._options.ipPort}. This means that KNX-Ultimate received a malformed Header or CEMI message from your KNX Gateway.`,
			)
			// try {
			// 05/01/2022 Avoid disconnecting, because there are many bugged knx gateways out there!
			// this.emit(KNXClientEvents.error, e);
			// this._setDisconnected();
			// } catch (error) {}
		}
	}

	_sendDescriptionRequestMessage() {
		this.send(
			KNXProtocol.newKNXDescriptionRequest(
				new HPAI(this._options.localIPAddress),
			),
		)
	}

	_sendSearchRequestMessage() {
		// this.send(KNXProtocol.newKNXSearchRequest(new HPAI.HPAI(this._options.localIPAddress, this._localPort)), KNX_CONSTANTS.KNX_PORT, KNX_CONSTANTS.KNX_IP);
	}

	_sendConnectRequestMessage(cri) {
		// try {
		//   const oHPAI = new HPAI.HPAI(this._options.localSocketAddress.address, this._options.localSocketAddress.port, this._options.hostProtocol === 'TunnelTCP' ? KNX_CONSTANTS.IPV4_TCP : KNX_CONSTANTS.IPV4_UDP)
		//   this.send(KNXProtocol.newKNXConnectRequest(cri, null, oHPAI))
		// } catch (error) {
		//   this.send(KNXProtocol.newKNXConnectRequest(cri))
		// }
		this.send(KNXProtocol.newKNXConnectRequest(cri))
	}

	_sendConnectionStateRequestMessage(channelID) {
		// try {
		//   const oHPAI = new HPAI.HPAI(this._options.localSocketAddress.address, this._options.localSocketAddress.port, this._options.hostProtocol === 'TunnelTCP' ? KNX_CONSTANTS.IPV4_TCP : KNX_CONSTANTS.IPV4_UDP)
		//   this.send(KNXProtocol.newKNXConnectionStateRequest(channelID, oHPAI))
		// } catch (error) {
		//   this.send(KNXProtocol.newKNXConnectionStateRequest(channelID))
		// }
		this.send(KNXProtocol.newKNXConnectionStateRequest(channelID))
	}

	_sendDisconnectRequestMessage(channelID) {
		// try {
		//   const oHPAI = new HPAI.HPAI(this._options.localSocketAddress.address, this._options.localSocketAddress.port, this._options.hostProtocol === 'TunnelTCP' ? KNX_CONSTANTS.IPV4_TCP : KNX_CONSTANTS.IPV4_UDP)
		//   this.send(KNXProtocol.newKNXDisconnectRequest(channelID, oHPAI))
		// } catch (error) {
		//   this.send(KNXProtocol.newKNXDisconnectRequest(channelID))
		// }
		this.send(KNXProtocol.newKNXDisconnectRequest(channelID))
	}

	_sendDisconnectResponseMessage(
		channelID,
		status = ConnectionStatus.E_NO_ERROR,
	) {
		this.send(KNXProtocol.newKNXDisconnectResponse(channelID, status))
	}

	_sendSecureSessionRequestMessage(cri) {
		const oHPAI = new HPAI(
			'0.0.0.0',
			0,
			this._options.hostProtocol === 'TunnelTCP'
				? KNX_CONSTANTS.IPV4_TCP
				: KNX_CONSTANTS.IPV4_UDP,
		)
		this.send(KNXProtocol.newKNXSecureSessionRequest(cri, oHPAI))
	}
}
