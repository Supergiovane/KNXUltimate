import KNXPacket from './KNXPacket'
import { KNX_CONSTANTS } from './KNXConstants'
import CEMIFactory from './cEMI/CEMIFactory'
import CEMIMessage from './cEMI/CEMIMessage'

export default class KNXRoutingIndication extends KNXPacket {
	cEMIMessage: CEMIMessage

	constructor(cEMIMessage: CEMIMessage) {
		super(KNX_CONSTANTS.ROUTING_INDICATION, cEMIMessage.length)
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
	): KNXRoutingIndication {
		if (offset >= buffer.length) {
			throw new Error('Buffer too short')
		}
		const cEMIMessage = this.parseCEMIMessage(buffer, offset)
		return new KNXRoutingIndication(cEMIMessage)
	}

	toBuffer(): Buffer {
		return Buffer.concat([
			this.header.toBuffer(),
			this.cEMIMessage.toBuffer(),
		])
	}
}
