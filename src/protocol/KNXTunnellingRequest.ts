import KNXPacket from './KNXPacket'
import { KNX_CONSTANTS } from './KNXConstants'
import CEMIFactory from './cEMI/CEMIFactory'
import CEMIMessage from './cEMI/CEMIMessage'

export default class KNXTunnellingRequest extends KNXPacket {
	channelID: number

	seqCounter: number

	cEMIMessage: CEMIMessage

	constructor(
		channelID: number,
		seqCounter: number,
		cEMIMessage: CEMIMessage,
	) {
		super(KNX_CONSTANTS.TUNNELLING_REQUEST, 4 + cEMIMessage.length)
		this.channelID = channelID
		this.seqCounter = seqCounter
		this.cEMIMessage = cEMIMessage
	}

	static parseCEMIMessage(buffer: Buffer, offset: number): CEMIMessage {
		if (offset > buffer.length) {
			throw new Error('Buffer too short')
		}
		const msgCode = buffer.readUInt8(offset++)
		return CEMIFactory.createFromBuffer(msgCode, buffer, offset)
	}

	static createFromBuffer(
		buffer: Buffer,
		offset: number = 0,
	): KNXTunnellingRequest {
		if (offset >= buffer.length) {
			throw new Error('Buffer too short')
		}
		const structureLength = buffer.readUInt8(offset)
		if (offset + structureLength > buffer.length) {
			throw new Error('Buffer too short')
		}
		offset += 1
		const channelID = buffer.readUInt8(offset++)
		const seqCounter = buffer.readUInt8(offset++)
		offset++
		const cEMIMessage = this.parseCEMIMessage(buffer, offset)
		return new KNXTunnellingRequest(channelID, seqCounter, cEMIMessage)
	}

	toBuffer(): Buffer {
		const buffer = Buffer.alloc(4)
		buffer.writeUInt8(4, 0)
		buffer.writeUInt8(this.channelID, 1)
		buffer.writeUInt8(this.seqCounter, 2)
		buffer.writeUInt8(0, 3)
		return Buffer.concat([
			this.header.toBuffer(),
			buffer,
			this.cEMIMessage.toBuffer(),
		])
	}
}
