/**
 * Simple FT1.2 mock gateway for tests/dev. Emits/receives cEMI frames over a TCP socket
 * so we can simulate the serial transport without hardware.
 */

import { createServer, Server, Socket } from 'net'
import { TypedEventEmitter } from '../../src/TypedEmitter'
import CEMIConstants from '../../src/protocol/cEMI/CEMIConstants'
import LDataInd from '../../src/protocol/cEMI/LDataInd'
import KNXAddress from '../../src/protocol/KNXAddress'
import ControlField from '../../src/protocol/cEMI/ControlField'
import NPDU from '../../src/protocol/cEMI/NPDU'
import KNXDataBuffer from '../../src/protocol/KNXDataBuffer'

export type Ft12GatewayEvents = {
	error: (error: Error) => void
	ready: () => void
	frame: (payload: Buffer) => void
}

const ACK_BYTE = Buffer.from([0xe5])
const RESET_FRAME = Buffer.from([0x10, 0x40, 0x40, 0x16])

function buildLongFrame(payload: Buffer, seq: boolean): Buffer {
	const len = payload.length + 1
	const frame = Buffer.alloc(payload.length + 7)
	frame[0] = 0x68
	frame[1] = len
	frame[2] = len
	frame[3] = 0x68
	frame[4] = seq ? 0x73 : 0x53
	payload.copy(frame, 5)
	let checksum = frame[4]
	for (let i = 0; i < payload.length; i += 1) {
		checksum = (checksum + payload[i]) & 0xff
	}
	frame[frame.length - 2] = checksum
	frame[frame.length - 1] = 0x16
	return frame
}

export class MockFt12Gateway extends TypedEventEmitter<Ft12GatewayEvents> {
	private server?: Server

	private client?: Socket

	private sendSeq = false

	constructor(private readonly port: number = 9900) {
		super()
	}

	async start(): Promise<void> {
		if (this.server) return
		await new Promise<void>((resolve, reject) => {
			this.server = createServer((socket) =>
				this.handleConnection(socket),
			)
			this.server.once('error', reject)
			this.server.listen(this.port, () => {
				this.server?.off('error', reject)
				this.emit('ready')
				resolve()
			})
		})
	}

	async stop(): Promise<void> {
		if (!this.server) return
		await new Promise<void>((resolve) => {
			this.server?.close(() => resolve())
		})
		this.server = undefined
		this.client?.destroy()
		this.client = undefined
	}

	private handleConnection(socket: Socket) {
		this.client = socket
		socket.on('data', (chunk) => this.handleData(chunk))
		socket.on('error', (err) => this.emit('error', err))
		socket.on('close', () => {
			this.client = undefined
		})
	}

	private handleData(buffer: Buffer) {
		if (buffer.equals(RESET_FRAME)) {
			this.sendAck()
			return
		}
		if (buffer.length >= 2 && buffer[0] === 0xf6) {
			this.sendAck()
			// ignore comm-mode write payload
			return
		}
		if (buffer.length >= 7 && buffer[0] === 0x68) {
			// Extract payload after header/control
			const len = buffer[1]
			const payload = buffer.subarray(5, 5 + len - 1)
			this.sendAck()
			try {
				this.emit('frame', payload)
				// Echo back as if it was seen on the bus
				this.broadcastTelegram(payload)
			} catch (err) {
				this.emit('error', err as Error)
			}
		}
	}

	private sendAck() {
		this.client?.write(ACK_BYTE)
	}

	private broadcastTelegram(payload: Buffer) {
		const frame = buildLongFrame(payload, this.sendSeq)
		this.sendSeq = !this.sendSeq
		this.client?.write(frame)
	}

	sendGroupWrite(src = '1.1.1', dst = '1/2/3', value = true) {
		const control = new ControlField()
		control.addressType = 1
		control.broadcast = 1
		const npdu = new NPDU(NPDU.TPCI_UNUMBERED_PACKET, 0)
		npdu.action = value ? NPDU.GROUP_WRITE : NPDU.GROUP_RESPONSE
		npdu.data = new KNXDataBuffer(Buffer.from([value ? 0x01 : 0x00]))
		const cemi = new LDataInd(
			null,
			control,
			KNXAddress.createFromString(src),
			KNXAddress.createFromString(dst, KNXAddress.TYPE_GROUP),
			npdu,
		)
		const buffer = cemi.toBuffer()
		const payload = Buffer.concat([
			Buffer.from([CEMIConstants.L_DATA_IND]),
			buffer,
		])
		this.broadcastTelegram(payload)
	}
}
