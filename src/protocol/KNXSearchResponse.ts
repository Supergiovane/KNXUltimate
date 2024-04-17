import { KNX_CONSTANTS } from './KNXConstants'
import KNXPacket from './KNXPacket'
import DeviceInfo from './DeviceInfo'
import ServiceFamilies from './ServiceFamilies'
import HPAI from './HPAI'

export default class KNXSearchResponse extends KNXPacket {
	hpai: HPAI

	deviceInfo: DeviceInfo

	serviceFamilies: ServiceFamilies

	constructor(
		hpai: HPAI,
		deviceInfo: DeviceInfo,
		serviceFamilies: ServiceFamilies,
	) {
		super(
			KNX_CONSTANTS.SEARCH_RESPONSE,
			hpai.length + deviceInfo.length + serviceFamilies.length,
		)
		this.hpai = hpai
		this.deviceInfo = deviceInfo
		this.serviceFamilies = serviceFamilies
	}

	static createFromBuffer(
		buffer: Buffer,
		offset: number = 0,
	): KNXSearchResponse {
		const hpai = HPAI.createFromBuffer(buffer, offset)
		offset += hpai.length
		const deviceInfo = DeviceInfo.createFromBuffer(buffer, offset)
		offset += deviceInfo.length
		const serviceFamilies = ServiceFamilies.createFromBuffer(buffer, offset)
		return new KNXSearchResponse(hpai, deviceInfo, serviceFamilies)
	}

	toBuffer(): Buffer {
		return Buffer.concat([
			this.header.toBuffer(),
			this.hpai.toBuffer(),
			this.deviceInfo.toBuffer(),
			this.serviceFamilies.toBuffer(),
		])
	}
}
