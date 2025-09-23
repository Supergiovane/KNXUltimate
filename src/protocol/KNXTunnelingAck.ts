/**
 * Represents KNX tunnelling acknowledgements.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import KNXPacket from './KNXPacket'
import { KNX_CONSTANTS } from './KNXConstants'

export default class KNXTunnelingAck extends KNXPacket {
	channelID: number

	seqCounter: number

	status: number

	constructor(channelID: number, seqCounter: number, status: number) {
		super(KNX_CONSTANTS.TUNNELING_ACK, 4)
		this.channelID = channelID
		this.seqCounter = seqCounter
		this.status = status
	}

	static createFromBuffer(
		buffer: Buffer,
		offset: number = 0,
	): KNXTunnelingAck {
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
		const status = buffer.readUInt8(offset)
		return new KNXTunnelingAck(channelID, seqCounter, status)
	}

	toBuffer(): Buffer {
		const buffer = Buffer.alloc(this.length)
		buffer.writeUInt8(this.length, 0)
		buffer.writeUInt8(this.channelID, 1)
		buffer.writeUInt8(this.seqCounter, 2)
		buffer.writeUInt8(this.status, 3)
		return Buffer.concat([this.header.toBuffer(), buffer])
	}
}
