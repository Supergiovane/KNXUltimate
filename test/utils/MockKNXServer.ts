/**
 * Mocks a KNX/IP server used across tests.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { createSocket, RemoteInfo, Socket as UDPSocket } from 'dgram'
import { Socket as TCPSocket } from 'net'
import { TypedEventEmitter } from '../../src/TypedEmitter'
import { KNXClientEvents } from '../../src/KNXClient'
import {
	KNXClient,
	KNXConnectionStateResponse,
	SnifferPacket,
	SocketEvents,
} from '../../src'
import { wait } from '../../src/utils'

enum MockServerEvents {
	error = 'error',
}

interface MockServerEventCallbacks {
	error: (error: Error) => void
}

export type ServerOptions = {
	port?: number
	host?: string
	protocol?: 'udp' | 'tcp'
	useFakeTimers?: boolean
}

export default class MockKNXServer extends TypedEventEmitter<MockServerEventCallbacks> {
	public static port = 3671

	public static host = '192.168.1.116'

	public static physicalAddress = '10.15.251'

	private socket: UDPSocket | TCPSocket

	private client: KNXClient

	private expectedTelegrams: SnifferPacket[]

	private lastIndex = 0

	private used: Set<number> = new Set()

	private isPaused: boolean = false

	private useFakeTimers: boolean = false

	get rInfo(): RemoteInfo {
		return {
			address: MockKNXServer.host,
			port: MockKNXServer.port,
			family: 'IPv4',
			size: 0, // not used
		}
	}

	constructor(
		capturedTelegrams: SnifferPacket[],
		client: KNXClient,
		options: ServerOptions = {},
	) {
		super()
		this.expectedTelegrams = capturedTelegrams
		this.client = client
		this.useFakeTimers = options.useFakeTimers || false
	}

	private log(message: string) {
		this.client['sysLogger'].info(`[MockKNXServer] ${message}`)
	}

	private _lastRequestHex?: string

	private error(message: string) {
		const extra = this._lastRequestHex ? ` req=${this._lastRequestHex}` : ''
		this.client['sysLogger'].error(`[MockKNXServer] ${message}${extra}`)
		this.emit(MockServerEvents.error, new Error(`${message}${extra}`))
	}

	public createFakeSocket() {
		// TODO: create the correct socket based on client hostProtocol
		this.client['_clientSocket'] = createSocket({
			type: 'udp4',
			reuseAddr: false,
		})
		this.socket = this.client['_clientSocket']

		// intercept write method to capture outgoing data
		if (this.socket instanceof TCPSocket) {
			this.socket.write = (data: Buffer, ...args) => {
				this.onRequest(data)

				// call callback if any
				if (
					args.length > 0 &&
					typeof args[args.length - 1] === 'function'
				) {
					args[args.length - 1]()
				}

				return true
			}
		} else {
			this.socket.send = (data: Buffer, ...args: any[]) => {
				this.onRequest(data)

				// call callback if any
				if (
					args.length > 0 &&
					typeof args[args.length - 1] === 'function'
				) {
					args[args.length - 1]()
				}
			}

			this.socket.on(SocketEvents.message, (buf) => {
				this.client['processInboundMessage'](buf, this.rInfo)
			})

			this.socket.on(SocketEvents.error, (error) =>
				this.client.emit('error', error),
			)

			this.socket.on(SocketEvents.close, () => this.client.emit('close'))
		}

		this.client['socketReady'] = true

		this.log('MockKNXServer initialized')
	}

	public setPaused(paused: boolean) {
		this.isPaused = paused
		this.log(`Server ${paused ? 'paused' : 'resumed'}`)
	}

	// Handles incoming connections and data
	private async onRequest(data: Buffer) {
		const requestHex = data.toString('hex')
		this._lastRequestHex = requestHex
		this.log(`Received request: ${requestHex}`)
		// eslint-disable-next-line no-console
		console.log('[REQ]', requestHex)

		// If we consumed all expectations, ignore further requests
		if (this.lastIndex >= this.expectedTelegrams.length) {
			this.log('No more expectations; ignoring request')
			return
		}

		// Look up the captured response (robust matching)
		// Debug helper for matching state
		// eslint-disable-next-line no-console
		console.log(
			'[MockKNXServer] match from index',
			this.lastIndex,
			'of',
			this.expectedTelegrams.length,
		)
		// eslint-disable-next-line no-console
		console.log(
			'[MockKNXServer] expected[0]=',
			this.expectedTelegrams[0]?.request,
		)
		// eslint-disable-next-line no-console
		console.log(
			'[MockKNXServer] expected[1]=',
			this.expectedTelegrams[1]?.request,
		)
		if (this.expectedTelegrams[this.lastIndex]?.request) {
			console.log(
				'[MockKNXServer] compare lens:',
				this.expectedTelegrams[this.lastIndex].request.length,
				'vs incoming',
				requestHex.length,
			)
		}
		const serviceOf = (hex: string) =>
			hex && hex.length >= 8 ? hex.substring(4, 8) : ''
		const looseTypes = new Set([
			'0201',
			'020b',
			'0205',
			'0207',
			'0209',
			'0420',
			'0421',
		])
		const typeServiceMap: Record<string, string> = {
			KNXConnectRequest: '0205',
			KNXConnectionStateRequest: '0207',
			KNXDisconnectRequest: '0209',
			KNXTunnelingRequest: '0420',
			KNXTunnelingAck: '0421',
		}
		const si = serviceOf(requestHex)
		const isMatchAt = (packet: SnifferPacket, i: number) => {
			if (this.used.has(i)) return false
			const exp = packet.request
			if (exp) {
				if (exp === requestHex) return true
				const se = serviceOf(exp)
				return se === si && looseTypes.has(se)
			}
			const se2 = packet.reqType
				? typeServiceMap[packet.reqType]
				: undefined
			return !!se2 && se2 === si
		}

		let resIndex = -1
		// Prefer a match at or after lastIndex
		for (let i = this.lastIndex; i < this.expectedTelegrams.length; i++) {
			if (isMatchAt(this.expectedTelegrams[i], i)) {
				resIndex = i
				break
			}
		}
		// Fallback: search the whole sequence for an unused candidate
		if (resIndex < 0) {
			for (let i = 0; i < this.expectedTelegrams.length; i++) {
				if (isMatchAt(this.expectedTelegrams[i], i)) {
					resIndex = i
					break
				}
			}
		}
		// Fallback: accept SEARCH_REQUEST_EXTENDED when expecting SEARCH_REQUEST
		if (resIndex < 0) {
			const expected = this.expectedTelegrams[this.lastIndex]
			// Accept either SEARCH_REQUEST (0x0201) or EXTENDED (0x020b) interchangeably
			const expIsPlain = expected?.request?.startsWith('06100201')
			const expIsExt = expected?.request?.startsWith('0610020b')
			const inIsPlain = requestHex.startsWith('06100201')
			const inIsExt = requestHex.startsWith('0610020b')
			console.log('[MockKNXServer] fallback flags', {
				expIsPlain,
				expIsExt,
				inIsPlain,
				inIsExt,
			})
			if ((expIsPlain && inIsExt) || (expIsExt && inIsPlain)) {
				resIndex = this.lastIndex
				console.log('[MockKNXServer] fallback matched at', resIndex)
			}
		}

		const res = this.expectedTelegrams[resIndex]
		this.log(`BANANA ${resIndex}`)
		// Update lastIndex if we found a matching request
		if (resIndex >= 0) {
			this.used.add(resIndex)
			if (resIndex >= this.lastIndex) this.lastIndex = resIndex + 1
		}

		// When paused, don't send any response
		if (this.isPaused) {
			this.log('Server is paused, simulating network disconnection')
			return
		}

		if (res?.response) {
			this.log(`Found matching response, waiting ${res.deltaRes}ms`)
			// Skip waiting when using fake timers
			if (!this.useFakeTimers) {
				await wait(res.deltaRes || 0)
			}
			this.log(`Sending response: ${res.response}`)
			const responseBuffer = Buffer.from(res.response, 'hex')
			this.socket.emit('message', responseBuffer, this.rInfo)

			// Handle following automatic responses (no request)
			for (
				let j = this.lastIndex;
				j < this.expectedTelegrams.length;
				j++
			) {
				const auto = this.expectedTelegrams[j]
				if (!auto || this.used.has(j) || auto.request) break
				if (!this.useFakeTimers) {
					await wait(auto.deltaReq || 0)
				}
				this.log(`Sending automatic response: ${auto.response}`)
				const autoBuf = Buffer.from(auto.response, 'hex')
				this.socket.emit('message', autoBuf, this.rInfo)
				this.used.add(j)
				this.lastIndex = j + 1
			}
		} else if (resIndex >= 0) {
			// Matched a request with no response defined; treat as no-op
			this.log('Matched request with no response; continuing')
		} else {
			if (si === '0421') {
				this.log('No expectation for tunneling ACK; ignoring')
				return
			}
			this.error('No matching response found for this request.')
		}
	}
}
