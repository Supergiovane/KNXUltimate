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

	private expectedTelegrams: SnifferPacket[]

	private lastIndex = 0

	private rinfo: { address: string; port: number } | null = null

	constructor(
		capturedTelegrams: SnifferPacket[],
		socket: UDPSocket | TCPSocket,
	) {
		console.log('[MOCK] Initializing MockKNXServer')
		this.expectedTelegrams = capturedTelegrams
		this.socket = socket

		// Track the remote info from the first request
		if (socket instanceof UDPSocket) {
			console.log('[MOCK] UDP socket detected')
			const originalOn = socket.on.bind(socket)
			socket.on = (event: string, listener: any) => {
				if (event === 'message') {
					return originalOn(event, (msg: Buffer, rinfo: any) => {
						this.rinfo = rinfo
						return listener(msg, rinfo)
					})
				}
				return originalOn(event, listener)
			}

			const originalSend = socket.send.bind(socket)
			socket.send = (data: Buffer, ...args: any[]) => {
				this.onRequest(data)
				return originalSend(data, ...args)
			}
		} else {
			console.log('[MOCK] TCP socket detected')
			const originalWrite = socket.write.bind(socket)
			socket.write = (data: Buffer) => {
				this.onRequest(data)
				return originalWrite(data)
			}
		}
		console.log('[MOCK] MockKNXServer initialized')
	}

	// Handles incoming connections and data
	private async onRequest(data: Buffer) {
		const requestHex = data.toString('hex')
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
				if (this.socket instanceof UDPSocket && this.rinfo) {
					// For UDP, we need to send back to the specific address and port
					this.socket.send(
						responseBuffer,
						this.rinfo.port,
						this.rinfo.address,
						(err) => {
							if (err) {
								console.error('[MOCK] UDP send error:', err)
							} else {
								console.log(
									'[MOCK] UDP response sent successfully',
								)
							}
						},
					)
				} else {
					// For TCP or when no rinfo is available
					this.socket.emit('message', responseBuffer, {
						address: process.env.CI ? '127.0.0.1' : '192.168.1.116',
						port: 3671,
						family: 'IPv4',
						size: responseBuffer.length,
					})
					console.log('[MOCK] Response emitted successfully')
				}
			} catch (error) {
				console.error('[MOCK] Error sending response:', error)
			}
		} else {
			console.log('[MOCK] No matching response found for this request')
		}
	}
}
