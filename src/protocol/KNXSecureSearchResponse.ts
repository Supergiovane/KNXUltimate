/**
 * Parses KNX Secure search responses.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { KNX_CONSTANTS } from './KNXConstants'
import KNXPacket from './KNXPacket'
import HPAI from './HPAI'
import DeviceInfo from './DeviceInfo'
import ServiceFamilies from './ServiceFamilies'

// Parser for Search Response Extended (0x020C). We reuse this class name
// but map it to the extended search response semantics.
export default class KNXSecureSearchResponse extends KNXPacket {
	hpai: HPAI

	deviceInfo?: DeviceInfo

	serviceFamilies?: ServiceFamilies

	securedServiceFamilies?: ServiceFamilies

	constructor(
		hpai: HPAI,
		deviceInfo?: DeviceInfo,
		serviceFamilies?: ServiceFamilies,
		securedServiceFamilies?: ServiceFamilies,
	) {
		super(
			KNX_CONSTANTS.SEARCH_RESPONSE_EXTENDED,
			hpai.length +
				(deviceInfo?.length ?? 0) +
				(serviceFamilies?.length ?? 0) +
				(securedServiceFamilies?.length ?? 0),
		)
		this.hpai = hpai
		this.deviceInfo = deviceInfo
		this.serviceFamilies = serviceFamilies
		this.securedServiceFamilies = securedServiceFamilies
	}

	static createFromBuffer(
		buffer: Buffer,
		offset = 0,
	): KNXSecureSearchResponse {
		const hpai = HPAI.createFromBuffer(buffer, offset)
		offset += hpai.length
		let deviceInfo: DeviceInfo | undefined
		let families: ServiceFamilies | undefined
		let secFamilies: ServiceFamilies | undefined

		while (offset + 2 <= buffer.length) {
			const len = buffer.readUInt8(offset)
			if (len < 2 || offset + len > buffer.length) break
			const type = buffer.readUInt8(offset + 1)
			switch (type) {
				case KNX_CONSTANTS.DEVICE_INFO:
					deviceInfo = DeviceInfo.createFromBuffer(buffer, offset)
					offset += deviceInfo.length
					break
				case KNX_CONSTANTS.SUPP_SVC_FAMILIES:
					families = ServiceFamilies.createFromBuffer(buffer, offset)
					offset += families.length
					break
				case KNX_CONSTANTS.SECURED_SERVICE_FAMILIES:
					secFamilies = ServiceFamilies.createFromBuffer(
						buffer,
						offset,
					)
					offset += secFamilies.length
					break
				default:
					offset += len
			}
		}

		return new KNXSecureSearchResponse(
			hpai,
			deviceInfo,
			families,
			secFamilies,
		)
	}

	toBuffer(): Buffer {
		const parts: Buffer[] = [this.header.toBuffer(), this.hpai.toBuffer()]
		if (this.deviceInfo) parts.push(this.deviceInfo.toBuffer())
		if (this.serviceFamilies) parts.push(this.serviceFamilies.toBuffer())
		if (this.securedServiceFamilies)
			parts.push(this.securedServiceFamilies.toBuffer())
		return Buffer.concat(parts)
	}

	get hasSecurity(): boolean {
		return !!this.securedServiceFamilies
	}
}
