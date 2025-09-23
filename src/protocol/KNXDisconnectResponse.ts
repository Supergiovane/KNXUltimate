/**
 * Parses KNX disconnect response frames.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import KNXPacket from './KNXPacket'
import { KNX_CONSTANTS } from './KNXConstants'

export default class KNXDisconnectResponse extends KNXPacket {
	channelID: number

	status: number

	constructor(channelID: number, status: number) {
		super(KNX_CONSTANTS.DISCONNECT_RESPONSE, 2)
		this.channelID = channelID
		this.status = status
	}

	static createFromBuffer(
		buffer: Buffer,
		offset: number = 0,
	): KNXDisconnectResponse {
		if (offset >= buffer.length) {
			throw new Error('Buffer too short')
		}
		const channelID = buffer.readUInt8(offset++)
		const status = buffer.readUInt8(offset)
		return new KNXDisconnectResponse(channelID, status)
	}

	toBuffer(): Buffer {
		const buffer = Buffer.alloc(2)
		buffer.writeUInt8(this.channelID, 0)
		buffer.writeUInt8(this.status, 1)
		return Buffer.concat([this.header.toBuffer(), buffer])
	}
}
