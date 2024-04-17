import { KNX_CONSTANTS } from './KNXConstants'
import KNXAddress from './KNXAddress'

export default class KNXAddresses {
	private _type: number

	private _addresses: Set<KNXAddress>

	constructor() {
		this._type = KNX_CONSTANTS.KNX_ADDRESSES
		this._addresses = new Set<KNXAddress>()
	}

	get length(): number {
		return 2 + this._addresses.size * 2
	}

	get type(): number {
		return this._type
	}

	static createFromBuffer(buffer: Buffer, offset: number = 0): KNXAddresses {
		if (offset + this.length >= buffer.length) {
			throw new Error(
				`offset ${offset} out of buffer range ${buffer.length}`,
			)
		}
		const structureLength = buffer.readUInt8(offset)
		if (offset + structureLength > buffer.length) {
			throw new Error(
				`offset ${offset} block length: ${structureLength} out of buffer range ${buffer.length}`,
			)
		}
		offset++
		const type = buffer.readUInt8(offset++)
		if (type !== KNX_CONSTANTS.KNX_ADDRESSES) {
			throw new Error(`Invalid KNXAddresses type ${type}`)
		}
		const knxAddresses = new KNXAddresses()
		for (let i = 2; i < structureLength; i += 2) {
			knxAddresses.add(buffer.readUInt16BE(offset).toString())
			offset += 2
		}
		return knxAddresses
	}

	add(address: string): void {
		this._addresses.add(KNXAddress.createFromString(address))
	}

	toBuffer(): Buffer {
		const buffer = Buffer.alloc(this.length)
		let offset = 0
		buffer.writeUInt8(this.length, offset++)
		buffer.writeUInt8(KNX_CONSTANTS.KNX_ADDRESSES, offset++)
		for (const knxAddress of this._addresses) {
			buffer.writeUInt16BE(knxAddress.get(), offset)
			offset += 2
		}
		return buffer
	}
}
