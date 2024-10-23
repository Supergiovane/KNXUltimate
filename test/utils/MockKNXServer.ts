import { createSocket, Socket as UDPSocket } from 'dgram'
import { Socket as TCPSocket } from 'net'
import { KNXClient, SnifferPacket, SocketEvents } from 'src'
import { wait } from 'src/utils'

export type ServerOptions = {
	port?: number
	host?: string
	protocol?: 'udp' | 'tcp'
}

export default class MockKNXServer {
	private socket: UDPSocket | TCPSocket

	private client: KNXClient

	private expectedTelegrams: SnifferPacket[]

	private lastIndex = 0

	constructor(capturedTelegrams: SnifferPacket[], client: KNXClient) {
		console.log('[MOCK] Initializing MockKNXServer')
		this.expectedTelegrams = capturedTelegrams
		this.client = client
		this.client['createSocket'] = this.createFakeSocket.bind(this)
	}

	private createFakeSocket() {
		console.log('[MOCK] Creating fake socket')
		// TODO: create the correct socket based on client hostProtocol
		this.client['_clientSocket'] = createSocket({
			type: 'udp4',
			reuseAddr: false,
		})
		this.socket = this.client['_clientSocket']

		// intercept write method to capture outgoing data
		if (this.socket instanceof TCPSocket) {
			console.log('[MOCK] TCP socket detected')
			const originalWrite = this.socket.write
			this.socket.write = (data: Buffer) => {
				this.onRequest(data)
				return originalWrite.call(this.socket, data)
			}
		} else {
			console.log('[MOCK] UDP socket detected')
			const originalSend = this.socket.send
			this.socket.send = (data: Buffer, ...args: any[]) => {
				this.onRequest(data)
				return originalSend.call(this.socket, data, ...args)
			}

			this.socket.on(
				SocketEvents.message,
				this.client['processInboundMessage'].bind(this.client),
			)

			this.socket.on(SocketEvents.error, (error) =>
				this.client.emit('error', error),
			)

			this.socket.on(SocketEvents.close, () => this.client.emit('close'))
		}
		console.log('[MOCK] MockKNXServer initialized')
	}

	// Handles incoming connections and data
	private async onRequest(data: Buffer) {
		const requestHex = data.toString('hex') // Convert data to hex string
		console.log(`[MOCK] Received request: ${requestHex}`)

		// Look up the captured response
		const resIndex = this.expectedTelegrams.findIndex(
			(packet, i) => i >= this.lastIndex && packet.request === requestHex,
		)

		const res = this.expectedTelegrams[resIndex]

		this.lastIndex = resIndex >= 0 ? resIndex + 1 : this.lastIndex
		if (res && res.response) {
			console.log(
				`[MOCK] Found matching response, waiting ${res.deltaRes}ms`,
			)
			await wait(res.deltaRes || 0)
			console.log(`[MOCK] Sending response: ${res.response}`)
			const responseBuffer = Buffer.from(res.response, 'hex')

			try {
				this.socket.emit('message', responseBuffer)
				console.log('[MOCK] Response sent successfully')
			} catch (error) {
				console.error('[MOCK] Error sending response:', error)
			}
		} else {
			console.log('[MOCK] No matching response found for this request.')
		}
	}
}
