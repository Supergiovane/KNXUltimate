import { Socket as UDPSocket } from 'dgram'
import { Socket as TCPSocket } from 'net'
import { SnifferPacket } from 'src'

export default class MockKNXServer {
	private socket: UDPSocket | TCPSocket

	private expectedTelegrams: SnifferPacket[]

	private requestHandlers: Map<string, () => void> = new Map()

	constructor(
		capturedTelegrams: SnifferPacket[],
		socket: UDPSocket | TCPSocket,
	) {
		console.log('[MOCK] Initializing MockKNXServer')
		this.expectedTelegrams = capturedTelegrams
		this.socket = socket

		// For UDP sockets
		if (socket instanceof UDPSocket) {
			console.log('[MOCK] Setting up UDP mock server')
			socket.on('message', (msg: Buffer, rinfo: any) => {
				console.log('[MOCK] UDP message received:', msg.toString('hex'))
				this.handleRequest(msg, rinfo)
			})
		} else {
			// For TCP sockets
			console.log('[MOCK] Setting up TCP mock server')
			socket.on('data', (data: Buffer) => {
				console.log('[MOCK] TCP data received:', data.toString('hex'))
				this.handleRequest(data)
			})
		}

		// Set up request handlers
		this.setupRequestHandlers()

		console.log(
			'[MOCK] MockKNXServer initialized with handlers:',
			Array.from(this.requestHandlers.keys()),
		)
	}

	private setupRequestHandlers() {
		this.expectedTelegrams.forEach((telegram) => {
			this.requestHandlers.set(telegram.request, () => {
				console.log(
					'[MOCK] Found matching request handler for:',
					telegram.request,
				)
				setTimeout(() => {
					if (telegram.response) {
						console.log(
							'[MOCK] Sending response:',
							telegram.response,
						)
						const responseBuffer = Buffer.from(
							telegram.response,
							'hex',
						)

						if (this.socket instanceof UDPSocket) {
							// Emit directly as a message event
							this.socket.emit('message', responseBuffer, {
								address: process.env.CI
									? '127.0.0.1'
									: '192.168.1.116',
								port: 3671,
								family: 'IPv4',
								size: responseBuffer.length,
							})
							console.log('[MOCK] UDP response emitted')
						} else {
							// For TCP, emit as data
							this.socket.emit('data', responseBuffer)
							console.log('[MOCK] TCP response emitted')
						}
					}
				}, telegram.deltaRes || 0)
			})
		})
	}

	private handleRequest(data: Buffer, rinfo?: any) {
		const requestHex = data.toString('hex')
		console.log('[MOCK] Processing request:', requestHex)

		const handler = this.requestHandlers.get(requestHex)
		if (handler) {
			console.log('[MOCK] Handler found, executing')
			handler()
		} else {
			console.log('[MOCK] No handler found for request:', requestHex)
			console.log(
				'[MOCK] Available handlers:',
				Array.from(this.requestHandlers.keys()),
			)
		}
	}
}
