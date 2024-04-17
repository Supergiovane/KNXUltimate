import { KNX_CONSTANTS } from './KNXConstants'
import { splitIP, validateKNXAddress } from './KNXUtils'

const DEVICE_INFO_LENGTH = 0x36
const SERIALNUMBER_LENGTH = 6
const MACADDRESS_LENGTH = 6
const NAME_LENGTH = 30

export enum Medium {
	TP1 = KNX_CONSTANTS.TP1,
	PL110 = KNX_CONSTANTS.PL110,
	RF = KNX_CONSTANTS.RF,
	IP = KNX_CONSTANTS.IP,
}

export default class DeviceInfo {
	private _type: number = KNX_CONSTANTS.DEVICE_INFO

	private _medium: Medium

	private _status: number

	private _address: number

	private _projectID: number

	private _serialNumber: number[]

	private _splitIP: RegExpMatchArray

	private _macAddress: number[]

	private _name: string

	constructor(
		medium: Medium,
		status: number,
		address: number,
		projectID: number,
		serialNumber: number[],
		ip: string,
		macAddress: number[],
		name: string,
	) {
		this._medium = medium
		this._status = status
		this._address = address
		this._projectID = projectID
		this._serialNumber = serialNumber
		this.ip = ip
		this._macAddress = macAddress
		this.name = name
	}

	get type(): number {
		return this._type
	}

	set ip(ip: string) {
		this._splitIP = splitIP(ip)
	}

	get ip(): string {
		return this._splitIP.input
	}

	get status(): number {
		return this._status
	}

	set status(status: number) {
		this._status = status & 1
	}

	set name(name: string) {
		if (name.length > NAME_LENGTH) {
			throw new Error(
				`Invalid name format or too long - ${name}(${name.length}`,
			)
		}
		this._name = name
	}

	get name(): string {
		return this._name
	}

	set projectID(id: number) {
		const _id = Number(id)
		if (isNaN(_id) || _id > 0xffff || _id < 0) {
			throw new Error('Invalid project id')
		}
		this._projectID = _id
	}

	get projectID(): number {
		return this._projectID
	}

	set serialNumber(serialNumber: number[]) {
		this._serialNumber = DeviceInfo.validArray(
			serialNumber,
			SERIALNUMBER_LENGTH,
		)
	}

	get serialNumber(): number[] {
		return this._serialNumber
	}

	set macAddress(macAddress: number[]) {
		this._macAddress = DeviceInfo.validArray(macAddress, MACADDRESS_LENGTH)
	}

	get macAddress(): number[] {
		return this._macAddress
	}

	set medium(medium: Medium) {
		this._medium = medium
	}

	get medium(): Medium {
		return this._medium
	}

	get formattedMedium(): string {
		switch (this._medium) {
			case KNX_CONSTANTS.TP1:
				return 'TP1'
			case KNX_CONSTANTS.PL110:
				return 'PL110'
			case KNX_CONSTANTS.RF:
				return 'RF'
			case KNX_CONSTANTS.IP:
				return 'IP'
		}
	}

	set address(address: number) {
		this._address = validateKNXAddress(address)
	}

	get address(): number {
		return this._address
	}

	get formattedAddress(): string {
		let address = ''
		if (this._address > 0xfff) {
			address = `${(this._address & 0xf000) >> 12}.`
		}
		address += `${(this._address & 0x0f00) >> 8}.${this._address & 0xff}`
		return address
	}

	get length(): number {
		return DEVICE_INFO_LENGTH
	}

	static createFromBuffer(buffer: Buffer, offset: number = 0): DeviceInfo {
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
		if (type !== KNX_CONSTANTS.DEVICE_INFO) {
			throw new Error(`Invalid DeviceInfo type ${type}`)
		}
		const medium = buffer.readUInt8(offset++)
		const status = buffer.readUInt8(offset++)
		const address = buffer.readUInt16BE(offset)
		offset += 2
		const projectID = buffer.readUInt16BE(offset)
		offset += 2
		const serialNumber = [0, 0, 0, 0, 0, 0]
		for (let i = 0; i < SERIALNUMBER_LENGTH; i++) {
			serialNumber[i] = buffer.readUInt8(offset++)
		}
		const ip = []
		for (let i = 1; i <= 4; i++) {
			ip.push(buffer.readUInt8(offset++))
		}
		const textIP = ip.join('.')
		const macAddress = [0, 0, 0, 0, 0, 0]
		for (let i = 0; i < MACADDRESS_LENGTH; i++) {
			macAddress[i] = buffer.readUInt8(offset++)
		}
		let name = ''
		for (let i = 0; i < NAME_LENGTH; i++) {
			const char = buffer.readUInt8(offset++)
			if (char !== 0) {
				name += String.fromCharCode(char)
			} else {
				break
			}
		}
		return new DeviceInfo(
			medium,
			status,
			address,
			projectID,
			serialNumber,
			textIP,
			macAddress,
			name,
		)
	}

	setMediumFromString(medium: string) {
		switch (medium) {
			case 'TP1':
				this._medium = KNX_CONSTANTS.TP1
				break
			case 'PL110':
				this._medium = KNX_CONSTANTS.PL110
				break
			case 'RF':
				this._medium = KNX_CONSTANTS.RF
				break
			case 'IP':
				this._medium = KNX_CONSTANTS.IP
				break
			default:
				throw new Error(`Invalid medium ${medium}`)
		}
	}

	toBuffer(): Buffer {
		const buffer = Buffer.alloc(DEVICE_INFO_LENGTH)
		let offset = 0
		buffer.writeUInt8(this.length, offset++)
		buffer.writeUInt8(KNX_CONSTANTS.DEVICE_INFO, offset++)
		buffer.writeUInt8(this.medium, offset++)
		buffer.writeUInt8(this.status, offset++)
		buffer.writeUInt16BE(this.address, offset)
		offset += 2
		buffer.writeUInt16BE(this.projectID, offset)
		offset += 2
		for (let i = 0; i < this.serialNumber.length; i++) {
			buffer.writeUInt8(this.serialNumber[i], offset++)
		}
		for (let i = 1; i <= KNX_CONSTANTS.IPV4_ADDRESS_LENGTH; i++) {
			buffer.writeUInt8(Number(this._splitIP[i]), offset++)
		}
		for (let i = 0; i < this.macAddress.length; i++) {
			buffer.writeUInt8(this.macAddress[i], offset++)
		}
		for (let i = 0; i < NAME_LENGTH; i++) {
			buffer.writeUInt8(
				i >= this.name.length ? 0 : Number(this.name[i]),
				offset++,
			)
		}
		return buffer
	}

	static validArray(a: number[], length: number): number[] {
		if (!Array.isArray(a) || a.length !== length) {
			throw new Error('Invalid array format')
		}
		const validA = [0, 0, 0, 0, 0, 0]
		for (let i = 0; i < a.length; i++) {
			validA[i] = Number(a[i])
			if (isNaN(validA[i]) || validA[i] < 0 || validA[i] > 255) {
				throw new Error(`Invalid byte at pos ${i}`)
			}
		}
		return validA
	}
}
