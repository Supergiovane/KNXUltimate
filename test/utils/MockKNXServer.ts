import { createSocket, RemoteInfo, Socket as UDPSocket } from 'dgram'
import { Socket as TCPSocket } from 'net'
import {
	KNXClient,
	KNXConnectionStateResponse,
	SnifferPacket,
	SocketEvents,
} from 'src'
import { ConnectionStatus, KNX_CONSTANTS } from 'src/protocol/KNXConstants'
import { wait } from 'src/utils'

export type ServerOptions = {
	port?: number
	host?: string
	protocol?: 'udp' | 'tcp'
}

export default class MockKNXServer {
	public static port = 3671

	public static host = '192.168.1.116'

	public static physicalAddress = '10.15.2'

	private socket: UDPSocket | TCPSocket

	private client: KNXClient

	private expectedTelegrams: SnifferPacket[]

	private lastIndex = 0

	private isPaused: boolean = false

	get rInfo(): RemoteInfo {
		return {
			address: MockKNXServer.host,
			port: MockKNXServer.port,
			family: 'IPv4',
			size: 0, // not used
		}
	}

	constructor(capturedTelegrams: SnifferPacket[], client: KNXClient) {
		this.expectedTelegrams = capturedTelegrams
		this.client = client
	}

	private log(message: string) {
		this.client['sysLogger'].info(`[MockKNXServer] ${message}`)
	}

	private error(message: string) {
		this.client['sysLogger'].error(`[MockKNXServer] ${message}`)
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
			this.socket.write = (data: Buffer) => {
				this.onRequest(data)
				return true
			}
		} else {
			this.socket.send = (data: Buffer, ...args: any[]) => {
				this.onRequest(data)
			}

			this.socket.on(SocketEvents.message, (buf) => {
				this.client['processInboundMessage'](buf, this.rInfo)
			})

			this.socket.on(SocketEvents.error, (error) =>
				this.client.emit('error', error),
			)

			this.socket.on(SocketEvents.close, () => this.client.emit('close'))
		}

		this.log('MockKNXServer initialized')
	}

	public setPaused(paused: boolean) {
		this.isPaused = paused
		this.log(`Server ${paused ? 'paused' : 'resumed'}`)
	}

	// Handles incoming connections and data
	private async onRequest(data: Buffer) {
		const requestHex = data.toString('hex')
		this.log(`Received request: ${requestHex}`)

		// Look up the captured response
		const resIndex = this.expectedTelegrams.findIndex(
			(packet, i) => i >= this.lastIndex && packet.request === requestHex,
		)

		const res = this.expectedTelegrams[resIndex]

		// Update lastIndex if we found a matching request
		if (resIndex >= 0) {
			this.lastIndex = resIndex + 1
		}

		// When paused, don't send any response
		if (this.isPaused) {
			this.log('Server is paused, simulating network disconnection')
			return
		}

		if (res?.response) {
			this.log(`Found matching response, waiting ${res.deltaRes}ms`)
			await wait(res.deltaRes || 0)
			this.log(`Sending response: ${res.response}`)
			const responseBuffer = Buffer.from(res.response, 'hex')
			this.socket.emit('message', responseBuffer, this.rInfo)

			// Handle next automatic response if any
			const next = this.expectedTelegrams[this.lastIndex]
			if (next && !next.request) {
				await wait(next.deltaReq || 0)
				this.log(`Sending automatic response: ${next.response}`)
				const nextResponseBuffer = Buffer.from(next.response, 'hex')
				this.socket.emit('message', nextResponseBuffer, this.rInfo)
				this.lastIndex++
			}
		} else {
			this.error('No matching response found for this request.')
		}
	}
}
