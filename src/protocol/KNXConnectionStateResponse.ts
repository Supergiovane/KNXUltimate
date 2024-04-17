import KNXPacket from './KNXPacket'
import { KNX_CONSTANTS } from './KNXConstants'

export default class KNXConnectionStateResponse extends KNXPacket {
	channelID: number

	status: number

	constructor(channelID: number, status: number) {
		super(KNX_CONSTANTS.CONNECTIONSTATE_RESPONSE, 2)
		this.channelID = channelID
		this.status = status
	}

	static createFromBuffer(
		buffer: Buffer,
		offset: number = 0,
	): KNXConnectionStateResponse {
		if (offset >= buffer.length) {
			throw new Error('Buffer too short')
		}
		const channelID = buffer.readUInt8(offset++)
		const status = buffer.readUInt8(offset)
		return new KNXConnectionStateResponse(channelID, status)
	}

	static statusToString(status: number): string {
		switch (status) {
			case KNX_CONSTANTS.E_SEQUENCE_NUMBER:
				return 'Invalid Sequence Number'
			case KNX_CONSTANTS.E_CONNECTION_ID:
				return 'Invalid Connection ID'
			case KNX_CONSTANTS.E_CONNECTION_TYPE:
				return 'Invalid Connection Type'
			case KNX_CONSTANTS.E_CONNECTION_OPTION:
				return 'Invalid Connection Option'
			case KNX_CONSTANTS.E_NO_MORE_CONNECTIONS:
				return 'No More Connections'
			case KNX_CONSTANTS.E_DATA_CONNECTION:
				return 'Invalid Data Connection'
			case KNX_CONSTANTS.E_KNX_CONNECTION:
				return 'Invalid KNX Connection'
			case KNX_CONSTANTS.E_TUNNELING_LAYER:
				return 'Invalid Tunneling Layer'
			default:
				return `Unknown error ${status}`
		}
	}

	toBuffer(): Buffer {
		const buffer = Buffer.alloc(2)
		buffer.writeUInt8(this.channelID, 0)
		buffer.writeUInt8(this.status, 1)
		return Buffer.concat([this.header.toBuffer(), buffer])
	}
}
