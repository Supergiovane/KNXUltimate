import { KNX_CONSTANTS } from './KNXConstants'

export default class ServiceFamilies {
	private _type: number

	private _services: Map<number, number>

	constructor() {
		this._type = KNX_CONSTANTS.SUPP_SVC_FAMILIES
		this._services = new Map<number, number>()
	}

	get type(): number {
		return this._type
	}

	get length(): number {
		return 2 * this._services.size + 2
	}

	get services(): Map<number, number> {
		return this._services
	}

	static createFromBuffer(buffer: Buffer, offset: number = 0) {
		if (offset >= buffer.length) {
			throw new Error(
				`offset ${offset} out of buffer range ${buffer.length}`,
			)
		}
		const structureLength: number = buffer.readUInt8(offset)
		if (offset + structureLength > buffer.length) {
			throw new Error(
				`offset ${offset} block length: ${structureLength} out of buffer range ${buffer.length}`,
			)
		}
		offset++
        const type: number = buffer.readUInt8(offset++)
        // Accept both standard and secured service families (0x02 and 0x06)
        if (
            type !== KNX_CONSTANTS.SUPP_SVC_FAMILIES &&
            type !== KNX_CONSTANTS.SECURED_SERVICE_FAMILIES
        ) {
            throw new Error(`Invalid Service Family type ${type}`)
        }
        const serviceFamily: ServiceFamilies = new ServiceFamilies()
        // preserve actual DIB type (02 = SUPP_SVC_FAMILIES, 06 = SECURED_SERVICE_FAMILIES)
        ;(serviceFamily as any)._type = type
		for (let i = 2; i < structureLength; i += 2) {
			serviceFamily.set(
				buffer.readUInt8(offset),
				buffer.readUInt8(offset + 1),
			)
			offset += 2
		}
		return serviceFamily
	}

	set(id: number, version: number): void {
		const _id: number = Number(id)
		if (isNaN(_id) || id > 0xff || id < 0) {
			throw new Error('Invalid service id')
		}
		const _version: number = Number(version)
		if (isNaN(_version) || version > 0xff || version < 0) {
			throw new Error('Invalid service version')
		}
		this._services.set(id, version)
	}

	service(id: number): number | undefined {
		return this._services.get(id)
	}

	toBuffer(): Buffer {
		const buffer: Buffer = Buffer.alloc(this.length)
		let offset: number = 0
		buffer.writeUInt8(this.length, offset++)
		buffer.writeUInt8(KNX_CONSTANTS.SUPP_SVC_FAMILIES, offset++)
		for (const [id, version] of this._services) {
			buffer.writeUInt8(id, offset++)
			buffer.writeUInt8(version, offset++)
		}
		return buffer
	}
}
