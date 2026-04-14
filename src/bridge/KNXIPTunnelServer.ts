/**
 * KNXnet/IP Tunneling server (UDP) with "bus" hooks.
 *
 * This is intended for bridges/proxies that want to accept a KNX/IP tunneling
 * client (e.g. LogicMachine) and forward traffic to another medium (routing/multicast, TP, etc).
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import * as dgram from 'dgram'
import os from 'os'
import { TypedEventEmitter } from '../TypedEmitter'
import { module, LogLevel, KNXLogger } from '../KnxLog'
import { KNX_CONSTANTS } from '../protocol/KNXConstants'
import KNXHeader from '../protocol/KNXHeader'
import KNXProtocol from '../protocol/KNXProtocol'
import KNXConnectRequest from '../protocol/KNXConnectRequest'
import KNXConnectResponse from '../protocol/KNXConnectResponse'
import KNXConnectionStateRequest from '../protocol/KNXConnectionStateRequest'
import KNXConnectionStateResponse from '../protocol/KNXConnectionStateResponse'
import KNXDisconnectRequest from '../protocol/KNXDisconnectRequest'
import KNXDisconnectResponse from '../protocol/KNXDisconnectResponse'
import KNXTunnelingRequest from '../protocol/KNXTunnelingRequest'
import KNXTunnelingAck from '../protocol/KNXTunnelingAck'
import HPAI, { KnxProtocol as HPAIProtocol } from '../protocol/HPAI'
import CRD, { ConnectionType } from '../protocol/CRD'
import KNXAddress, { KNXAddressType } from '../protocol/KNXAddress'
import CEMIConstants from '../protocol/cEMI/CEMIConstants'
import CEMIMessage from '../protocol/cEMI/CEMIMessage'
import LDataInd from '../protocol/cEMI/LDataInd'
import KNXRoutingIndication from '../protocol/KNXRoutingIndication'

export type KNXIPTunnelServerOptions = {
	listenHost?: string
	listenPort?: number
	advertiseHost?: string

	assignedIndividualAddress?: string

	loglevel?: LogLevel
	maxSessions?: number
}

export type KNXRawTelegramEvent =
	| 'GroupValue_Write'
	| 'GroupValue_Response'
	| 'GroupValue_Read'

export type KNXRawTelegram = {
	event: KNXRawTelegramEvent
	source: string
	destination: string
	apdu: { data: Buffer | null; bitlength: number; hex: string }
	cemi: { hex: string }
}

type TunnelServerEvents = {
	error: (error: Error) => void
	listening: (info: { host: string; port: number }) => void
	sessionUp: (info: {
		clientHost: string
		clientPort: number
		channelId: number
	}) => void
	sessionDown: (info: {
		clientHost: string
		clientPort: number
		channelId?: number
		reason: string
	}) => void

	// Emitted when the server receives a client telegram that should be injected on the "bus".
	busFrameOut: (frame: Buffer, info: { channelId: number }) => void

	// Compatibility with KNXClient: consumers (e.g. node-red filter nodes) can reuse the same handler.
	indication: (packet: KNXRoutingIndication, echoed: boolean) => void

	// Convenience: emits already-extracted fields compatible with node-red-contrib-knx-ultimate MultiRouting format.
	rawTelegram: (telegram: KNXRawTelegram, info: { channelId: number }) => void
}

type ClientKey = string

function clientKey(host: string, port: number): ClientKey {
	return `${host}:${port}`
}

function isWildcardHost(host: string | undefined): boolean {
	return !host || host === '0.0.0.0' || host === '::' || host === '::0'
}

function guessAdvertiseHost(listenHost: string | undefined): string {
	if (listenHost && !isWildcardHost(listenHost)) return listenHost
	const ifaces = os.networkInterfaces()
	for (const entries of Object.values(ifaces)) {
		for (const entry of entries || []) {
			if (entry.family === 'IPv4' && !entry.internal) return entry.address
		}
	}
	return '127.0.0.1'
}

function effectiveEndpoint(hpai: HPAI | undefined, rinfo: dgram.RemoteInfo) {
	const host =
		hpai && hpai.host && hpai.host !== '0.0.0.0' ? hpai.host : rinfo.address
	const port = hpai && hpai.port && hpai.port !== 0 ? hpai.port : rinfo.port
	return { host, port }
}

type Session = {
	key: ClientKey
	clientRInfo: dgram.RemoteInfo
	clientControlHpai?: HPAI
	clientDataHpai?: HPAI

	channelId: number
	nextServerToClientSeq: number
}

export class KNXIPTunnelServer extends TypedEventEmitter<TunnelServerEvents> {
	private readonly options: Required<
		Pick<
			KNXIPTunnelServerOptions,
			| 'listenHost'
			| 'listenPort'
			| 'advertiseHost'
			| 'assignedIndividualAddress'
			| 'maxSessions'
		>
	> &
		Pick<KNXIPTunnelServerOptions, 'loglevel'>

	private readonly logger: KNXLogger

	private socket?: dgram.Socket

	private sessions: Map<ClientKey, Session> = new Map()

	private channelPool: number[] = []

	constructor(options: KNXIPTunnelServerOptions = {}) {
		super()
		this.options = {
			listenHost: options.listenHost ?? '0.0.0.0',
			listenPort: options.listenPort ?? KNX_CONSTANTS.KNX_PORT,
			advertiseHost:
				options.advertiseHost ?? guessAdvertiseHost(options.listenHost),
			assignedIndividualAddress:
				options.assignedIndividualAddress ?? '15.15.255',
			maxSessions: options.maxSessions ?? 1,
			loglevel: options.loglevel,
		}

		this.logger = module('KNXIPTunnelServer')
		if (this.options.loglevel) {
			try {
				this.logger.level = this.options.loglevel
			} catch {
				// ignore
			}
		}
		this.refillChannelPool()
	}

	get address(): { host: string; port: number } | null {
		if (!this.socket) return null
		const a = this.socket.address()
		return typeof a === 'object' ? { host: a.address, port: a.port } : null
	}

	async start(): Promise<void> {
		if (this.socket) return

		const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true })
		this.socket = sock

		sock.on('error', (err) => {
			this.emit('error', err)
			try {
				this.logger.error(`Socket error: ${err.message}`)
			} catch {
				// ignore
			}
		})

		sock.on('message', (msg, rinfo) => this.onMessage(msg, rinfo))

		await new Promise<void>((resolve, reject) => {
			sock.once('error', reject)
			sock.bind(this.options.listenPort, this.options.listenHost, () => {
				sock.off('error', reject)
				const a = this.address
				if (a) {
					try {
						this.logger.info(`Listening on ${a.host}:${a.port}`)
					} catch {
						// ignore
					}
					this.emit('listening', a)
				}
				resolve()
			})
		})
	}

	async stop(): Promise<void> {
		for (const session of this.sessions.values()) {
			this.emit('sessionDown', {
				clientHost: session.clientRInfo.address,
				clientPort: session.clientRInfo.port,
				channelId: session.channelId,
				reason: 'stopped',
			})
		}
		this.sessions.clear()
		this.refillChannelPool()

		if (!this.socket) return
		const sock = this.socket
		this.socket = undefined
		await new Promise<void>((resolve) => {
			try {
				sock.close(() => resolve())
			} catch {
				resolve()
			}
		})
	}

	/**
	 * Inject a bus frame into all active tunneling sessions.
	 * Expected input: KNXnet/IP frame buffer, typically ROUTING_INDICATION (0x0530).
	 */
	injectBusFrame(frame: Buffer) {
		for (const session of this.sessions.values()) {
			this.sendBusFrameToClient(session, frame)
		}
	}

	/**
	 * Inject a bus frame into a specific channel.
	 */
	injectBusFrameToChannel(channelId: number, frame: Buffer) {
		const session = this.findSessionByChannelId(channelId)
		if (!session) return
		this.sendBusFrameToClient(session, frame)
	}

	/**
	 * Inject a parsed routing indication to all sessions.
	 */
	injectIndication(packet: KNXRoutingIndication) {
		for (const session of this.sessions.values()) {
			this.sendCemiToClient(session, packet.cEMIMessage)
		}
	}

	/**
	 * Inject a parsed routing indication to a specific channel.
	 */
	injectIndicationToChannel(channelId: number, packet: KNXRoutingIndication) {
		const session = this.findSessionByChannelId(channelId)
		if (!session) return
		this.sendCemiToClient(session, packet.cEMIMessage)
	}

	/**
	 * Inject a cEMI message to all sessions.
	 * Typically use an L_DATA_IND when sending bus indications to clients.
	 */
	injectCemi(cemi: CEMIMessage) {
		for (const session of this.sessions.values()) {
			this.sendCemiToClient(session, cemi)
		}
	}

	/**
	 * Inject a cEMI message to a specific channel.
	 */
	injectCemiToChannel(channelId: number, cemi: CEMIMessage) {
		const session = this.findSessionByChannelId(channelId)
		if (!session) return
		this.sendCemiToClient(session, cemi)
	}

	private refillChannelPool() {
		this.channelPool = []
		// Avoid 0 (reserved)
		for (let i = 1; i <= 255; i++) this.channelPool.push(i)
	}

	private allocateChannelId(): number {
		if (this.channelPool.length === 0) this.refillChannelPool()
		return this.channelPool.shift()!
	}

	private freeChannelId(channelId: number) {
		if (channelId <= 0 || channelId > 255) return
		if (!this.channelPool.includes(channelId))
			this.channelPool.unshift(channelId)
	}

	private ensureSession(rinfo: dgram.RemoteInfo): Session {
		const key = clientKey(rinfo.address, rinfo.port)
		const existing = this.sessions.get(key)
		if (existing) {
			existing.clientRInfo = rinfo
			return existing
		}

		// Evict oldest if needed
		if (this.sessions.size >= this.options.maxSessions) {
			const firstKey = this.sessions.keys().next().value as
				| string
				| undefined
			if (firstKey) {
				const s = this.sessions.get(firstKey)
				if (s) this.closeSession(s, 'evicted')
			}
		}

		const channelId = this.allocateChannelId()
		const session: Session = {
			key,
			clientRInfo: rinfo,
			channelId,
			nextServerToClientSeq: 0,
		}
		this.sessions.set(key, session)
		return session
	}

	private getSession(rinfo: dgram.RemoteInfo): Session | undefined {
		const key = clientKey(rinfo.address, rinfo.port)
		const s = this.sessions.get(key)
		if (s) s.clientRInfo = rinfo
		return s
	}

	private findSessionByChannelId(channelId: number): Session | undefined {
		for (const session of this.sessions.values()) {
			if (session.channelId === channelId) return session
		}
		return undefined
	}

	private closeSession(session: Session, reason: string) {
		this.sessions.delete(session.key)
		this.freeChannelId(session.channelId)
		this.emit('sessionDown', {
			clientHost: session.clientRInfo.address,
			clientPort: session.clientRInfo.port,
			channelId: session.channelId,
			reason,
		})
	}

	private onMessage(msg: Buffer, rinfo: dgram.RemoteInfo) {
		let header: KNXHeader
		try {
			header = KNXHeader.createFromBuffer(msg)
		} catch {
			return
		}

		switch (header.service_type) {
			case KNX_CONSTANTS.CONNECT_REQUEST:
				this.handleConnectRequest(msg, rinfo)
				break
			case KNX_CONSTANTS.CONNECTIONSTATE_REQUEST:
				this.handleConnectionStateRequest(msg, rinfo)
				break
			case KNX_CONSTANTS.DISCONNECT_REQUEST:
				this.handleDisconnectRequest(msg, rinfo)
				break
			case KNX_CONSTANTS.TUNNELING_REQUEST:
				this.handleTunnelingRequest(msg, rinfo)
				break
			case KNX_CONSTANTS.TUNNELING_ACK:
				// optional; we currently ignore server->client ACKs
				break
			default:
				break
		}
	}

	private packetToFrame(packet: any): Buffer {
		const body = packet?.toBuffer?.()
		if (!Buffer.isBuffer(body)) {
			throw new Error('Invalid packet buffer')
		}
		// Most packets already include the KNXnet/IP header in toBuffer().
		if (body.length >= 2 && body[0] === 0x06 && body[1] === 0x10)
			return body
		const hdr = packet?.header?.toBuffer?.()
		if (Buffer.isBuffer(hdr)) return Buffer.concat([hdr, body])
		return body
	}

	private sendToClient(
		session: Session,
		payload: Buffer,
		target: 'control' | 'data' = 'control',
	) {
		if (!this.socket) return
		const hpai =
			target === 'data'
				? session.clientDataHpai
				: session.clientControlHpai
		const ep = effectiveEndpoint(hpai, session.clientRInfo)
		this.socket.send(payload, ep.port, ep.host)
	}

	private sendToRInfo(rinfo: dgram.RemoteInfo, payload: Buffer) {
		if (!this.socket) return
		this.socket.send(payload, rinfo.port, rinfo.address)
	}

	private handleConnectRequest(msg: Buffer, rinfo: dgram.RemoteInfo) {
		let connect: KNXConnectRequest
		try {
			const parsed = KNXProtocol.parseMessage(msg)
			connect = parsed.knxMessage as KNXConnectRequest
		} catch (e) {
			this.emit(
				'error',
				e instanceof Error ? e : new Error('CONNECT parse error'),
			)
			return
		}

		const session = this.ensureSession(rinfo)
		session.clientControlHpai = connect.hpaiControl
		session.clientDataHpai = connect.hpaiData

		// Basic validation
		const isTunnel =
			connect.cri &&
			(connect.cri as any).connectionType ===
				KNX_CONSTANTS.TUNNEL_CONNECTION
		if (!isTunnel) {
			const errResp = new KNXConnectResponse(
				session.channelId,
				KNX_CONSTANTS.E_CONNECTION_TYPE,
				null,
				null,
			)
			this.sendToClient(session, this.packetToFrame(errResp), 'control')
			return
		}

		const serverHpai = new HPAI(
			this.options.advertiseHost,
			this.address?.port ?? this.options.listenPort,
			HPAIProtocol.IPV4_UDP,
		)
		const assigned = KNXAddress.createFromString(
			this.options.assignedIndividualAddress,
			KNXAddressType.TYPE_INDIVIDUAL,
		)
		const crd = new CRD(ConnectionType.TUNNEL_CONNECTION, assigned)
		const resp = new KNXConnectResponse(
			session.channelId,
			0,
			serverHpai,
			crd,
		)

		try {
			this.logger.info(
				`CONNECT from ${rinfo.address}:${rinfo.port} -> ch=${session.channelId} assignedIA=${this.options.assignedIndividualAddress}`,
			)
		} catch {
			// ignore
		}

		this.sendToClient(session, this.packetToFrame(resp), 'control')
		this.emit('sessionUp', {
			clientHost: rinfo.address,
			clientPort: rinfo.port,
			channelId: session.channelId,
		})
	}

	private handleConnectionStateRequest(msg: Buffer, rinfo: dgram.RemoteInfo) {
		let req: KNXConnectionStateRequest
		try {
			const parsed = KNXProtocol.parseMessage(msg)
			req = parsed.knxMessage as KNXConnectionStateRequest
		} catch (e) {
			this.emit(
				'error',
				e instanceof Error
					? e
					: new Error('CONNECTIONSTATE parse error'),
			)
			return
		}

		const session = this.getSession(rinfo)
		const status =
			session && req.channelID === session.channelId
				? 0
				: KNX_CONSTANTS.E_KNX_CONNECTION
		const resp = new KNXConnectionStateResponse(req.channelID, status)
		if (session)
			this.sendToClient(session, this.packetToFrame(resp), 'control')
		else this.sendToRInfo(rinfo, this.packetToFrame(resp))
	}

	private handleDisconnectRequest(msg: Buffer, rinfo: dgram.RemoteInfo) {
		let req: KNXDisconnectRequest
		try {
			const parsed = KNXProtocol.parseMessage(msg)
			req = parsed.knxMessage as KNXDisconnectRequest
		} catch (e) {
			this.emit(
				'error',
				e instanceof Error ? e : new Error('DISCONNECT parse error'),
			)
			return
		}

		const session = this.getSession(rinfo)
		const status =
			session && req.channelID === session.channelId
				? 0
				: KNX_CONSTANTS.E_KNX_CONNECTION
		const resp = new KNXDisconnectResponse(req.channelID, status)
		if (session) {
			this.sendToClient(session, this.packetToFrame(resp), 'control')
			this.closeSession(session, 'disconnect')
		} else {
			this.sendToRInfo(rinfo, this.packetToFrame(resp))
		}
	}

	private handleTunnelingRequest(msg: Buffer, rinfo: dgram.RemoteInfo) {
		let req: KNXTunnelingRequest
		try {
			const parsed = KNXProtocol.parseMessage(msg)
			req = parsed.knxMessage as KNXTunnelingRequest
		} catch (e) {
			this.emit(
				'error',
				e instanceof Error
					? e
					: new Error('TUNNELING_REQUEST parse error'),
			)
			return
		}

		const session = this.getSession(rinfo)
		if (!session || req.channelID !== session.channelId) {
			const nack = new KNXTunnelingAck(
				req.channelID,
				req.seqCounter,
				KNX_CONSTANTS.E_KNX_CONNECTION,
			)
			this.sendToRInfo(rinfo, nack.toBuffer())
			return
		}

		// ACK immediately
		const ack = KNXProtocol.newKNXTunnelingACK(
			session.channelId,
			req.seqCounter,
			0,
		)
		this.sendToClient(session, ack.toBuffer(), 'control')

		// Forward to "bus" (bridge decides what to do).
		try {
			const routing = this.buildRoutingIndicationFromTunneling(
				req.cEMIMessage,
			)
			if (routing) {
				const busFrame = routing.toBuffer()
				this.emit('busFrameOut', busFrame, {
					channelId: session.channelId,
				})
				this.emit('indication', routing, false)
				const raw = this.extractRawTelegram(routing, false)
				if (raw)
					this.emit('rawTelegram', raw, {
						channelId: session.channelId,
					})
			}
		} catch (e) {
			this.emit(
				'error',
				e instanceof Error ? e : new Error('busFrameOut error'),
			)
		}
	}

	private extractRawTelegram(
		datagram: KNXRoutingIndication,
		echoed: boolean,
	): KNXRawTelegram | null {
		try {
			const npdu = datagram.cEMIMessage?.npdu
			if (!npdu) return null

			let event: KNXRawTelegramEvent | null = null
			if (npdu.isGroupRead) event = 'GroupValue_Read'
			if (npdu.isGroupResponse) event = 'GroupValue_Response'
			if (npdu.isGroupWrite) event = 'GroupValue_Write'
			if (!event) return null

			const source = datagram.cEMIMessage.srcAddress?.toString?.() || ''
			const destination =
				datagram.cEMIMessage.dstAddress?.toString?.() || ''
			if (!source || !destination) return null

			const cemiFromDatagram = datagram.cEMIMessage
				.toBuffer()
				.toString('hex')
			const cemiEtsHex = echoed
				? `2900BCD0${cemiFromDatagram.substring(8)}`
				: cemiFromDatagram

			let apduData: Buffer | null = null
			let apduBitlength = 0
			let apduHex = ''

			if (event !== 'GroupValue_Read') {
				const rawValue = datagram.cEMIMessage.npdu.dataValue
				apduData = Buffer.from(rawValue)
				apduBitlength =
					datagram.cEMIMessage.npdu.dataBuffer === null
						? 6
						: apduData.length * 8
				apduHex = apduData.toString('hex')
			}

			return {
				event,
				source,
				destination,
				apdu: {
					data: apduData,
					bitlength: apduBitlength,
					hex: apduHex,
				},
				cemi: { hex: cemiEtsHex },
			}
		} catch {
			return null
		}
	}

	private buildRoutingIndicationFromTunneling(
		cemi: CEMIMessage,
	): KNXRoutingIndication | null {
		// Only forward L_DATA_REQ/IND (bus telegrams)
		if (
			cemi.msgCode !== CEMIConstants.L_DATA_REQ &&
			cemi.msgCode !== CEMIConstants.L_DATA_IND
		) {
			return null
		}

		// Routing uses L_DATA_IND
		let ind: CEMIMessage
		if (cemi.msgCode === CEMIConstants.L_DATA_IND) {
			ind = cemi
		} else {
			const src = KNXAddress.createFromString(
				this.options.assignedIndividualAddress,
				KNXAddressType.TYPE_INDIVIDUAL,
			)
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			const additionalInfo = (cemi as any).additionalInfo ?? null
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			const control = (cemi as any).control
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			const dst = (cemi as any).dstAddress
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			const npdu = (cemi as any).npdu

			// Best-effort normalization for routing injection
			try {
				control.ack = 0
				control.broadcast = 1
			} catch {
				// ignore
			}

			ind = new LDataInd(additionalInfo, control, src, dst, npdu)
		}

		return KNXProtocol.newKNXRoutingIndication(ind as any)
	}

	private sendBusFrameToClient(session: Session, frame: Buffer) {
		// Expect a KNXnet/IP routing indication frame; parse and re-wrap into tunneling request.
		let parsed: ReturnType<typeof KNXProtocol.parseMessage>
		try {
			parsed = KNXProtocol.parseMessage(frame)
		} catch {
			return
		}

		if (parsed.knxHeader.service_type !== KNX_CONSTANTS.ROUTING_INDICATION)
			return
		const routing = parsed.knxMessage as any
		const cemi = routing?.cEMIMessage as CEMIMessage | undefined
		if (!cemi) return

		const seq = session.nextServerToClientSeq & 0xff
		session.nextServerToClientSeq =
			(session.nextServerToClientSeq + 1) & 0xff

		this.sendCemiToClient(session, cemi as any, seq)
	}

	private sendCemiToClient(
		session: Session,
		cemi: CEMIMessage,
		seqOverride?: number,
	) {
		const seq =
			typeof seqOverride === 'number'
				? seqOverride & 0xff
				: session.nextServerToClientSeq & 0xff
		if (typeof seqOverride !== 'number') {
			session.nextServerToClientSeq =
				(session.nextServerToClientSeq + 1) & 0xff
		}
		const tun = KNXProtocol.newKNXTunnelingRequest(
			session.channelId,
			seq,
			cemi as any,
		)
		this.sendToClient(session, tun.toBuffer(), 'data')
	}
}
