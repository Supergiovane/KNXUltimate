/**
 * Parses KNX gateway description responses.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { KNX_CONSTANTS } from './KNXConstants'
import KNXPacket from './KNXPacket'
import DeviceInfo from './DeviceInfo'
import ServiceFamilies from './ServiceFamilies'

export default class KNXDescriptionResponse extends KNXPacket {
	deviceInfo: DeviceInfo

	serviceFamilies: ServiceFamilies

	constructor(deviceInfo: DeviceInfo, serviceFamilies: ServiceFamilies) {
		super(
			KNX_CONSTANTS.DESCRIPTION_RESPONSE,
			deviceInfo.length + serviceFamilies.length,
		)
		this.deviceInfo = deviceInfo
		this.serviceFamilies = serviceFamilies
	}

	static createFromBuffer(
		buffer: Buffer,
		offset: number = 0,
	): KNXDescriptionResponse {
		if (offset + this.length >= buffer.length) {
			throw new Error('Buffer too short')
		}
		const deviceInfo = DeviceInfo.createFromBuffer(buffer, offset)
		offset += deviceInfo.length
		const serviceFamilies = ServiceFamilies.createFromBuffer(buffer, offset)
		return new KNXDescriptionResponse(deviceInfo, serviceFamilies)
	}

	toBuffer(): Buffer {
		return Buffer.concat([
			this.header.toBuffer(),
			this.deviceInfo.toBuffer(),
			this.serviceFamilies.toBuffer(),
		])
	}
}
