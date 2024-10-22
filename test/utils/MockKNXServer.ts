import { Socket as UDPSocket } from 'dgram'
import { Socket as TCPSocket } from 'net'
import { SnifferPacket, SocketEvents } from 'src'
import { wait } from 'src/utils'

export type ServerOptions = {
	port?: number
	host?: string
	protocol?: 'udp' | 'tcp'
}

export default class MockKNXServer {
	private socket: UDPSocket | TCPSocket

	private port: number

	private host: string

	private expectedTelegrams: SnifferPacket[]

	private lastIndex = 0

	constructor(
		capturedTelegrams: SnifferPacket[],
		socket: UDPSocket | TCPSocket,
	) {
		console.log('[MOCK] Initializing MockKNXServer')
		this.expectedTelegrams = capturedTelegrams
		this.socket = socket

		// intercept write method to capture outgoing data
		if (socket instanceof TCPSocket) {
			console.log('[MOCK] TCP socket detected')
			const originalWrite = socket.write
			socket.write = (data: Buffer) => {
				this.onRequest(data)
				return originalWrite.call(socket, data)
			}
		} else {
			console.log('[MOCK] UDP socket detected')
			const originalSend = socket.send
			socket.send = (data: Buffer, ...args: any[]) => {
				this.onRequest(data)
				return originalSend.call(socket, data, ...args)
			}
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

		if (res && res.response) {
			console.log(
				`[MOCK] Found matching response, waiting ${res.deltaRes}ms`,
			)
			await wait(res.deltaRes || 0)
			this.lastIndex = resIndex
			console.log(`[MOCK] Sending response: ${res.response}`)
			const responseBuffer = Buffer.from(res.response, 'hex')
			try {
				this.socket.emit('message', responseBuffer) // Send response as a buffer
				console.log('[MOCK] Response sent successfully')
			} catch (error) {
				console.error('[MOCK] Error sending response:', error)
			}
		} else {
			console.log('[MOCK] No matching response found for this request.')
		}
	}
}
