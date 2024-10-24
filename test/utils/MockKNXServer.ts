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

	private socket: UDPSocket | TCPSocket

	private client: KNXClient

	private expectedTelegrams: SnifferPacket[]

	private lastIndex = 0

	private connectionStateInterval: NodeJS.Timeout

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

	/** Send a conection state response every connectKeepalive interval */
	private setupHeartbeat() {
		const timeout =
			this.client['_options'].connectionKeepAliveTimeout ||
			KNX_CONSTANTS.CONNECTION_ALIVE_TIME
		this.connectionStateInterval = setInterval(
			() => {
				this.sendConnectionStateResponse()
			},
			(timeout / 3) * 1000,
		)
	}

	private sendConnectionStateResponse() {
		const response = new KNXConnectionStateResponse(
			this.client.channelID,
			ConnectionStatus.E_NO_ERROR,
		)

		const responseBuffer = response.toBuffer()

		this.socket.emit('message', responseBuffer, this.rInfo)
	}

	public close() {
		clearInterval(this.connectionStateInterval)
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

		this.client.on('connected', () => {
			this.sendConnectionStateResponse()
			this.setupHeartbeat()
		})

		this.client.on('close', () => {
			this.close()
		})

		this.log('MockKNXServer initialized')
	}

	// Handles incoming connections and data
	private async onRequest(data: Buffer) {
		const requestHex = data.toString('hex') // Convert data to hex string
		this.log(`Received request: ${requestHex}`)

		// Look up the captured response
		const resIndex = this.expectedTelegrams.findIndex(
			(packet, i) => i >= this.lastIndex && packet.request === requestHex,
		)

		const res = this.expectedTelegrams[resIndex]

		this.lastIndex = resIndex >= 0 ? resIndex + 1 : this.lastIndex
		if (res && res.response) {
			this.log(`Found matching response, waiting ${res.deltaRes}ms`)
			await wait(res.deltaRes || 0)
			this.log(`Sending response: ${res.response}`)
			const responseBuffer = Buffer.from(res.response, 'hex')

			this.socket.emit('message', responseBuffer)
		} else if (!res) {
			this.error('No matching response found for this request.')
		}
	}
}
