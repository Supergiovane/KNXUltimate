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
        let deviceInfo: DeviceInfo
        let serviceFamilies: ServiceFamilies

        // Iterate over remaining blocks, pick DEVICE_INFO and SUPP_SVC_FAMILIES in any order
        let foundDevice = false
        let foundServices = false
        while (offset + 2 <= buffer.length && (!foundDevice || !foundServices)) {
            const len = buffer.readUInt8(offset)
            if (len < 2 || offset + len > buffer.length) break
            const type = buffer.readUInt8(offset + 1)
            if (!foundDevice && type === KNX_CONSTANTS.DEVICE_INFO) {
                deviceInfo = DeviceInfo.createFromBuffer(buffer, offset)
                offset += deviceInfo.length
                foundDevice = true
                continue
            }
            if (!foundServices && type === KNX_CONSTANTS.SUPP_SVC_FAMILIES) {
                serviceFamilies = ServiceFamilies.createFromBuffer(buffer, offset)
                offset += serviceFamilies.length
                foundServices = true
                continue
            }
            // skip unknown / unneeded DIB
            offset += len
        }

        if (!foundDevice) {
            throw new Error('KNXSearchResponse: DEVICE_INFO DIB not found')
        }
        if (!foundServices) {
            // create empty service families to avoid crashes
            serviceFamilies = new ServiceFamilies()
        }

        return new KNXSearchResponse(hpai, deviceInfo!, serviceFamilies!)
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
