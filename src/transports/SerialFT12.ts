import { SerialPort, SerialPortOpenOptions } from 'serialport'
import { TypedEventEmitter } from '../TypedEmitter'
import { module as createLogger, KNXLogger } from '../KnxLog'

export type SerialPortSummary = {
	path: string
	manufacturer?: string
	serialNumber?: string
	vendorId?: string
	productId?: string
	type?: string
	locationId?: string
}

export interface SerialFT12Options {
	path?: string
	baudRate?: number
	dataBits?: number
	stopBits?: number
	parity?: 'none' | 'even' | 'odd'
	rtscts?: boolean
	dtr?: boolean
	timeoutMs?: number
}

type SerialFT12Events = {
	ready: () => void
	close: () => void
	error: (error: Error) => void
	cemi: (payload: Buffer) => void
}

const DEFAULT_PATH = '/dev/ttyAMA0'
const DEFAULT_TIMEOUT_MS = 1200
const ACK_BYTE = 0xe5

const COMM_MODE_FRAME = Buffer.from([
	0xf6, 0x00, 0x08, 0x01, 0x34, 0x10, 0x01, 0x00,
])

export default class SerialFT12 extends TypedEventEmitter<SerialFT12Events> {
	private port?: SerialPort

	private rxBuffer: Buffer = Buffer.alloc(0)

	private awaitingAck?: {
		resolve: () => void
		reject: (err: Error) => void
		timer: NodeJS.Timeout
	}

	private sendToggle = false

	private isClosing = false

	private logger: KNXLogger

	constructor(private readonly options: SerialFT12Options) {
		super()
		this.logger = createLogger('FT12')
	}

	static async listPorts(): Promise<SerialPortSummary[]> {
		const list = await SerialPort.list()
		return list.map((item) => ({
			path: item.path,
			manufacturer: item.manufacturer || undefined,
			serialNumber: item.serialNumber || undefined,
			vendorId: item.vendorId || undefined,
			productId: item.productId || undefined,
			type: item.pnpId || undefined,
			locationId: item.locationId || undefined,
		}))
	}

	async open(): Promise<void> {
		if (this.port) return
		const handler = await this.createSerialPort()
		this.port = handler
		this.attachPort(handler)
		await this.initialize()
	}

	async close(): Promise<void> {
		this.isClosing = true
		if (!this.port) {
			this.isClosing = false
			return
		}
		await new Promise<void>((resolve) => {
			const done = () => resolve()
			this.port?.once('close', done)
			try {
				this.port?.close((err) => {
					if (err) {
						this.logger.error(`FT1.2 close error: ${err.message}`)
						resolve()
					}
				})
			} catch (error) {
				this.logger.error(
					`FT1.2 close exception: ${(error as Error).message}`,
				)
				resolve()
			}
		})
		this.port = undefined
		this.isClosing = false
	}

	async sendCemiPayload(payload: Buffer): Promise<void> {
		if (!this.port) throw new Error('Serial FT1.2 port is not open')
		const frame = this.buildLongFrame(payload)
		await this.writeFrameWithAck(frame)
	}

	private async initialize() {
		await this.sendReset()
		await this.sendCommMode()
		this.emit('ready')
	}

	private async sendReset() {
		await this.writeRaw(Buffer.from([0x10, 0x40, 0x40, 0x16]))
		await this.waitForAck('reset')
	}

	private async sendCommMode() {
		await this.sendCemiPayload(COMM_MODE_FRAME)
	}

	private async createSerialPort(): Promise<SerialPort> {
		const serialOptions: SerialPortOpenOptions<any> = {
			path: this.options.path || DEFAULT_PATH,
			baudRate: this.options.baudRate ?? 19200,
			dataBits: (this.options.dataBits ?? 8) as 5 | 6 | 7 | 8,
			stopBits: (this.options.stopBits ?? 1) as 1 | 1.5 | 2,
			parity: this.options.parity ?? 'even',
			rtscts: this.options.rtscts ?? false,
			autoOpen: false,
		}
		return new Promise((resolve, reject) => {
			const port = new SerialPort(serialOptions)
			port.open((err) => {
				if (err) {
					reject(err)
					return
				}
				const desiredDtr = this.options.dtr ?? true
				port.set({ dtr: desiredDtr }, (setErr) => {
					if (setErr) {
						this.logger.warn(`Unable to set DTR: ${setErr.message}`)
					}
					resolve(port)
				})
			})
		})
	}

	private attachPort(port: SerialPort) {
		port.on('data', (chunk) => this.handleChunk(chunk))
		port.on('error', (error) => this.emit('error', error))
		port.on('close', () => {
			this.port = undefined
			if (!this.isClosing) {
				this.emit('close')
			}
		})
	}

	private handleChunk(chunk: Buffer) {
		this.rxBuffer = Buffer.concat([this.rxBuffer, chunk])
		while (this.rxBuffer.length > 0) {
			const byte = this.rxBuffer[0]
			if (byte === ACK_BYTE) {
				this.consumeBytes(1)
				this.resolveAck()
				continue
			}
			if (byte === 0x10) {
				if (this.rxBuffer.length < 4) break
				const frame = this.rxBuffer.subarray(0, 4)
				this.consumeBytes(4)
				this.handleShortFrame(frame)
				continue
			}
			if (byte === 0x68) {
				if (this.rxBuffer.length < 6) break
				const len = this.rxBuffer[1]
				const total = len + 6
				if (this.rxBuffer.length < total) break
				const frame = this.rxBuffer.subarray(0, total)
				this.consumeBytes(total)
				this.handleLongFrame(frame)
				continue
			}
			if (byte === 0xa0) {
				if (this.rxBuffer.length < 2) break
				const len = this.rxBuffer[1]
				const total = len + 2
				if (this.rxBuffer.length < total) break
				this.consumeBytes(total)
				continue
			}
			// Unknown leading byte, drop it
			this.consumeBytes(1)
		}
	}

	private consumeBytes(count: number) {
		this.rxBuffer = this.rxBuffer.subarray(count)
	}

	private handleShortFrame(frame: Buffer) {
		if (frame.length !== 4) return
		// short frames are rarely used in FT1.2 host mode; we simply acknowledge control frames
		this.sendAck()
	}

	private handleLongFrame(frame: Buffer) {
		if (frame.length < 8) return
		if (frame[0] !== 0x68 || frame[3] !== 0x68) return
		const len = frame[1]
		if (frame[2] !== len) return
		if (frame[frame.length - 1] !== 0x16) return
		const checksum = frame[frame.length - 2]
		let calc = frame[4]
		const payloadLen = len - 1
		const payload = frame.subarray(5, 5 + payloadLen)
		for (const byte of payload) {
			calc = (calc + byte) & 0xff
		}
		if (calc !== checksum) {
			this.logger.warn('Invalid FT1.2 checksum, dropping frame')
			return
		}
		this.sendAck()
		if (payload.length === 0) return
		this.emit('cemi', payload)
	}

	private sendAck() {
		this.writeRaw(Buffer.from([ACK_BYTE])).catch(() => {})
	}

	private buildLongFrame(payload: Buffer) {
		const len = payload.length + 1
		const frame = Buffer.alloc(payload.length + 7)
		frame[0] = 0x68
		frame[1] = len
		frame[2] = len
		frame[3] = 0x68
		frame[4] = this.sendToggle ? 0x73 : 0x53
		this.sendToggle = !this.sendToggle
		payload.copy(frame, 5)
		let checksum = frame[4]
		for (let i = 0; i < payload.length; i += 1) {
			checksum = (checksum + payload[i]) & 0xff
		}
		frame[frame.length - 2] = checksum
		frame[frame.length - 1] = 0x16
		return frame
	}

	private async writeFrameWithAck(frame: Buffer): Promise<void> {
		const ackPromise = this.waitForAck('frame')
		await this.writeRaw(frame)
		await ackPromise
	}

	private writeRaw(buffer: Buffer): Promise<void> {
		if (!this.port) {
			return Promise.reject(new Error('Serial port is closed'))
		}
		return new Promise((resolve, reject) => {
			this.port!.write(buffer, (err) => {
				if (err) {
					reject(err)
					return
				}
				this.port!.drain((drainErr) => {
					if (drainErr) {
						reject(drainErr)
						return
					}
					resolve()
				})
			})
		})
	}

	private waitForAck(label: string) {
		if (this.awaitingAck) {
			this.awaitingAck.reject(
				new Error('Previous FT1.2 ACK promise was still pending'),
			)
			this.awaitingAck = undefined
		}
		return new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.awaitingAck = undefined
				reject(new Error(`Timeout waiting for FT1.2 ACK (${label})`))
			}, this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
			this.awaitingAck = {
				resolve: () => {
					clearTimeout(timer)
					this.awaitingAck = undefined
					resolve()
				},
				reject: (err) => {
					clearTimeout(timer)
					this.awaitingAck = undefined
					reject(err)
				},
				timer,
			}
		})
	}

	private resolveAck() {
		if (!this.awaitingAck) return
		this.awaitingAck.resolve()
	}
}
