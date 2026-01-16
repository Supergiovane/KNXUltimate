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
	/** Treat the interface as a Weinzierl KBerry/BAOS module and run BAOS init (LinkLayer, indication, GA filter off). Default: true */
	isKBERRY?: boolean
	/** Forward to SerialPort "lock" flag. Default: true */
	lock?: boolean
}

type SerialFT12Events = {
	ready: () => void
	close: () => void
	error: (error: Error) => void
	cemi: (payload: Buffer) => void
}

const DEFAULT_PATH = '/dev/ttyAMA0'
const DEFAULT_TIMEOUT_MS = 1200
const RESET_TIMEOUT_MS = 3000
const RESET_RETRIES = 3
const CLOSE_GRACE_MS = 2000
const ACK_BYTE = 0xe5

const COMM_MODE_FRAME = Buffer.from([
	0xf6, 0x00, 0x08, 0x01, 0x34, 0x10, 0x01, 0x00,
])

export default class SerialFT12 extends TypedEventEmitter<SerialFT12Events> {
	private port?: SerialPort

	private portListeners?: {
		data: (chunk: Buffer) => void
		error: (error: Error) => void
		close: () => void
	}

	private rxBuffer: Buffer = Buffer.alloc(0)

	// Some KBerry/FT1.2 devices can emit an ACK before we arm waitForAck (e.g. on DTR toggle).
	// Keep a spare counter so the next waitForAck can resolve immediately.
	private pendingAck = 0

	private lastCloseAt?: number

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
		await this.waitAfterCloseIfNeeded()
		const handler = await this.createSerialPort()
		this.port = handler
		this.attachPort(handler)
		await this.initialize()
	}

	async close(): Promise<void> {
		this.isClosing = true
		const port = this.port
		if (!port) {
			this.isClosing = false
			return
		}
		// Politely notify the interface before closing to avoid leftover state on KBerry/BAOS.
		try {
			await this.sendReset()
			// Small grace to let the interface settle after reset.
			await new Promise<void>((resolve) => {
				setTimeout(resolve, 50)
			})
		} catch (err) {
			try {
				this.logger.warn(
					`FT1.2 close: reset before close failed: ${
						(err as Error).message
					}`,
				)
			} catch {}
		}
		await new Promise<void>((resolve) => {
			let settled = false
			let timeout: NodeJS.Timeout | undefined
			const done = () => {
				if (settled) return
				settled = true
				if (timeout) clearTimeout(timeout)
				port.off('close', done)
				resolve()
			}
			timeout = setTimeout(() => {
				try {
					this.logger.warn('FT1.2 close timed out; forcing cleanup')
				} catch {}
				done()
			}, this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
			timeout.unref?.()
			port.once('close', done)
			try {
				port.close((err) => {
					if (err) {
						this.logger.error(`FT1.2 close error: ${err.message}`)
					}
					done()
				})
			} catch (error) {
				this.logger.error(
					`FT1.2 close exception: ${(error as Error).message}`,
				)
				done()
			}
		})
		// Ensure the underlying serial handle really closes; retry once if it still reports open.
		try {
			if ((port as any).isOpen) {
				try {
					this.logger.warn(
						'FT1.2 close: port still open after close request, retrying',
					)
				} catch {}
				try {
					port.close((err) => {
						if (err) {
							try {
								this.logger.error(
									`FT1.2 force close error: ${err.message}`,
								)
							} catch {}
						}
					})
				} catch (err) {
					try {
						this.logger.error(
							`FT1.2 force close exception: ${
								(err as Error).message
							}`,
						)
					} catch {}
				}
			}
		} catch {}
		this.detachPortListeners(port)
		const pendingAck = this.awaitingAck
		if (pendingAck) {
			clearTimeout(pendingAck.timer)
			pendingAck.reject(new Error('Serial FT1.2 port closed'))
			this.awaitingAck = undefined
		}
		this.port = undefined
		this.rxBuffer = Buffer.alloc(0)
		this.pendingAck = 0
		this.lastCloseAt = Date.now()
		this.isClosing = false
	}

	async sendCemiPayload(payload: Buffer): Promise<void> {
		if (!this.port) throw new Error('Serial FT1.2 port is not open')
		const frame = this.buildLongFrame(payload)
		await this.writeFrameWithAck(frame)
	}

	private async initialize() {
		const isKBERRY = this.options.isKBERRY ?? true
		// Weinzierl KBerry / BAOS: full init sequence
		await this.sendReset()
		if (isKBERRY) {
			try {
				this.logger.debug('FT1.2 → SetServerItem indication sending=on')
			} catch {}
			await this.setIndicationSending(true)
			try {
				this.logger.debug(
					'FT1.2 → M_PropWrite COMM_MODE LinkLayer (f6 00 08 01 34 10 01 00)',
				)
			} catch {}
			await this.sendCommMode()
			try {
				this.logger.debug(
					'FT1.2 → M_PropWrite AddressTable length=0 (f6 04 00 01 02 10 01 00 00)',
				)
			} catch {}
			try {
				await this.disableGroupFilter()
			} catch (err) {
				this.logger.warn(
					`Unable to disable group-address filter: ${
						(err as Error).message
					}`,
				)
			}
		} else {
			// Generic FT1.2: only reset + COMM_MODE if requested
			await this.sendCommMode()
		}
		this.emit('ready')
	}

	private async sendReset() {
		let attempt = 0
		let lastErr: Error | undefined
		while (attempt < RESET_RETRIES) {
			attempt += 1
			try {
				this.logger.debug(
					`FT1.2 → RESET_REQ 10 40 40 16 (attempt ${attempt}/${RESET_RETRIES})`,
				)
			} catch {}
			const ackPromise = this.waitForAck(
				'reset',
				this.options.timeoutMs ?? RESET_TIMEOUT_MS,
			)
			await this.writeRaw(Buffer.from([0x10, 0x40, 0x40, 0x16]))
			try {
				await ackPromise
				return
			} catch (err) {
				lastErr = err as Error
				try {
					this.logger.warn(
						`FT1.2 RESET ack timeout (attempt ${attempt}/${RESET_RETRIES}): ${
							(lastErr as Error).message
						}`,
					)
				} catch {}
				if (attempt < RESET_RETRIES) {
					// Short backoff before retrying reset
					await new Promise<void>((resolve) => {
						setTimeout(resolve, 200)
					})
				}
			}
		}
		// Exhausted retries: continue initialisation anyway to avoid endless reconnect loops on devices
		// that sometimes drop the reset ACK (observed on some KBERRY units).
		try {
			this.logger.warn(
				`FT1.2 RESET ack missing after ${RESET_RETRIES} attempts, continuing initialisation`,
			)
		} catch {}
	}

	private async sendCommMode() {
		await this.sendCemiPayload(COMM_MODE_FRAME)
	}

	/**
	 * Enable/disable BAOS indication sending (ServerItem #16).
	 * When enabled, BAOS forwards cEMI indications to the host.
	 */
	private async setIndicationSending(enable: boolean) {
		const itemId = 0x0010
		const value = Buffer.from([enable ? 0x01 : 0x00])
		await this.sendBaosServerItem(itemId, value)
	}

	/**
	 * Set Address Table length = 0 so that KBerry forwards all group addresses.
	 * This affects receive-side filtering only.
	 */
	private async disableGroupFilter() {
		const cemi = Buffer.from([
			0xf6, // M_PropWrite.req
			0x04,
			0x00, // Interface Object: Address Table (4.0)
			0x01, // Object instance 1
			0x02, // Property ID 2 (Length)
			0x10, // descriptor: 1 element
			0x01, // start index = 1
			0x00,
			0x00, // new length = 0 (UINT16)
		])
		await this.sendCemiPayload(cemi)
	}

	private async sendBaosServerItem(itemId: number, data: Buffer) {
		const payload = Buffer.alloc(9 + data.length)
		let offset = 0
		payload[offset++] = 0xf0 // Main service: BAOS
		payload[offset++] = 0x02 // Sub service: SetServerItem
		payload.writeUInt16BE(itemId, offset)
		offset += 2 // start item id
		payload.writeUInt16BE(1, offset)
		offset += 2 // number of items
		payload.writeUInt16BE(itemId, offset)
		offset += 2 // first item id
		payload[offset++] = data.length
		data.copy(payload, offset)
		await this.sendBaosPayload(payload)
	}

	private async sendBaosPayload(payload: Buffer) {
		if (!this.port) throw new Error('Serial FT1.2 port is not open')
		try {
			this.logger.debug(`FT1.2 TX BAOS ${payload.toString('hex')}`)
		} catch {}
		const frame = this.buildLongFrame(payload)
		await this.writeFrameWithAck(frame)
	}

	private async createSerialPort(): Promise<SerialPort> {
		const serialOptions: SerialPortOpenOptions<any> = {
			path: this.options.path || DEFAULT_PATH,
			baudRate: this.options.baudRate ?? 19200,
			dataBits: (this.options.dataBits ?? 8) as 5 | 6 | 7 | 8,
			stopBits: (this.options.stopBits ?? 1) as 1 | 1.5 | 2,
			parity: this.options.parity ?? 'even',
			rtscts: this.options.rtscts ?? false,
			lock: this.options.lock ?? true,
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
		const onData = (chunk: Buffer) => this.handleChunk(chunk)
		const onError = (error: Error) => this.emit('error', error)
		const onClose = () => {
			this.port = undefined
			// Delay the close notification (even on intentional closes) to let the serial interface settle
			setTimeout(() => {
				this.emit('close')
			}, 2000).unref?.()
		}
		this.portListeners = {
			data: onData,
			error: onError,
			close: onClose,
		}
		port.on('data', onData)
		port.on('error', onError)
		port.on('close', onClose)
	}

	private detachPortListeners(port: SerialPort) {
		if (!this.portListeners) return
		const { data, error, close } = this.portListeners
		port.off('data', data)
		port.off('error', error)
		port.off('close', close)
		this.portListeners = undefined
	}

	private handleChunk(chunk: Buffer) {
		try {
			this.logger.debug(`FT1.2 RX chunk ${chunk.toString('hex')}`)
		} catch {}
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
		// BAOS payload (0xF0...) vs plain cEMI (0x11/0x29/0xF6/...)
		if (payload[0] === 0xf0) {
			try {
				this.logger.debug(`FT1.2 RX BAOS ${payload.toString('hex')}`)
			} catch {}
			return
		}
		try {
			this.logger.debug(`FT1.2 RX cEMI ${payload.toString('hex')}`)
		} catch {}
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
		try {
			this.logger.debug(`FT1.2 TX frame ${frame.toString('hex')}`)
		} catch {}
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

	private waitForAck(
		label: string,
		timeoutMs = this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
	) {
		if (this.awaitingAck) {
			// Overlapping ACK wait (for example during close/reset). Drop the previous waiter
			// instead of throwing, to avoid crashing the host application.
			try {
				this.logger.warn(
					`Previous FT1.2 ACK promise was still pending (${label}), dropping it`,
				)
			} catch {}
			clearTimeout(this.awaitingAck.timer)
			this.awaitingAck = undefined
		}
		// Resolve immediately if we already saw an ACK while no waiter was registered
		if (this.pendingAck > 0) {
			this.pendingAck -= 1
			return Promise.resolve()
		}
		return new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.awaitingAck = undefined
				reject(new Error(`Timeout waiting for FT1.2 ACK (${label})`))
			}, timeoutMs)
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

	private async waitAfterCloseIfNeeded() {
		if (!this.lastCloseAt) return
		const elapsed = Date.now() - this.lastCloseAt
		const delay = CLOSE_GRACE_MS - elapsed
		if (delay > 0) {
			await new Promise<void>((resolve) => {
				setTimeout(resolve, delay)
			})
		}
	}
}
