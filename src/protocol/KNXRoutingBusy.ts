/**
 * Represents the KNXnet/IP ROUTING_BUSY frame used for routing flow control.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { KNX_CONSTANTS } from './KNXConstants'
import KNXPacket from './KNXPacket'

const BUSY_INFO_LENGTH = 6

export default class KNXRoutingBusy extends KNXPacket {
	deviceState: number

	/** Wait time tw in milliseconds */
	waitTime: number

	controlField: number

	constructor(waitTime: number, deviceState = 0, controlField = 0) {
		super(KNX_CONSTANTS.ROUTING_BUSY, BUSY_INFO_LENGTH)
		this.waitTime = waitTime
		this.deviceState = deviceState
		this.controlField = controlField
	}

	static createFromBuffer(
		buffer: Buffer,
		offset: number = 0,
	): KNXRoutingBusy {
		if (buffer.length - offset !== BUSY_INFO_LENGTH) {
			throw new Error('ROUTING_BUSY has wrong length')
		}
		// Unlike XKNX, the structure length is not checked: the Annex B.17 example
		// says 04h for this 6-octet structure, and flow control must not be skipped
		return new KNXRoutingBusy(
			buffer.readUInt16BE(offset + 2),
			buffer.readUInt8(offset + 1),
			buffer.readUInt16BE(offset + 4),
		)
	}

	toBuffer(): Buffer {
		const body = Buffer.alloc(BUSY_INFO_LENGTH)
		body.writeUInt8(BUSY_INFO_LENGTH, 0)
		body.writeUInt8(this.deviceState, 1)
		body.writeUInt16BE(this.waitTime, 2)
		body.writeUInt16BE(this.controlField, 4)
		return Buffer.concat([this.header.toBuffer(), body])
	}
}
