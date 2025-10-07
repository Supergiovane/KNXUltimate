/**
 * Represents KNX IP configuration data blocks.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { splitIP } from './KNXUtils'
import { KNX_CONSTANTS } from './KNXConstants'

const IP_CONFIG_LENGTH: number = 16

export default class IPConfig {
	private _type: number = KNX_CONSTANTS.IP_CONFIG

	private _splitIP: RegExpMatchArray

	private _splitMask: RegExpMatchArray

	private _splitGateway: RegExpMatchArray

	public capabilities: number

	public assignment: number

	constructor(
		_ip: string,
		_mask: string,
		gateway: string,
		capabilities: number,
		assignment: number,
	) {
		this.capabilities = capabilities
		this.assignment = assignment
		this.ip = _ip
		this.mask = _mask
		this.gateway = gateway
	}

	get type(): number {
		return this._type
	}

	set ip(ip: string) {
		this._splitIP = splitIP(ip)
	}

	get ip(): string {
		return this._splitIP.join('.')
	}

	set mask(mask: string) {
		this._splitMask = splitIP(mask, 'mask')
	}

	get mask(): string {
		return this._splitMask.join('.')
	}

	set gateway(gateway: string) {
		this._splitGateway = splitIP(gateway, 'gateway')
	}

	get length(): number {
		return IP_CONFIG_LENGTH
	}

	static createFromBuffer(buffer: Buffer, offset: number = 0): IPConfig {
		if (offset + this.length >= buffer.length) {
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
		if (type !== KNX_CONSTANTS.IP_CONFIG) {
			throw new Error(`Invalid IPConfig type ${type}`)
		}
		const ip: number[] = []
		for (let i = 1; i <= 4; i++) {
			ip.push(buffer.readUInt8(offset++))
		}
		const textIP: string = ip.join('.')
		const mask: number[] = []
		for (let i = 1; i <= 4; i++) {
			mask.push(buffer.readUInt8(offset++))
		}
		const textMask: string = mask.join('.')
		const gateway: number[] = []
		for (let i = 1; i <= 4; i++) {
			gateway.push(buffer.readUInt8(offset++))
		}
		const textGateway: string = gateway.join('.')
		const capabilities: number = buffer.readUInt8(offset++)
		const assignment: number = buffer.readUInt8(offset)
		return new IPConfig(
			textIP,
			textMask,
			textGateway,
			capabilities,
			assignment,
		)
	}

	toBuffer(): Buffer {
		const buffer: Buffer = Buffer.alloc(this.length)
		let offset: number = 0
		buffer.writeUInt8(this.length, offset++)
		buffer.writeUInt8(KNX_CONSTANTS.IP_CONFIG, offset++)
		for (let i = 1; i <= KNX_CONSTANTS.IPV4_ADDRESS_LENGTH; i++) {
			buffer.writeUInt8(Number(this._splitIP[i]), offset++)
		}
		for (let i = 1; i <= KNX_CONSTANTS.IPV4_ADDRESS_LENGTH; i++) {
			buffer.writeUInt8(Number(this._splitMask[i]), offset++)
		}
		for (let i = 1; i <= KNX_CONSTANTS.IPV4_ADDRESS_LENGTH; i++) {
			buffer.writeUInt8(Number(this._splitGateway[i]), offset++)
		}
		buffer.writeUInt8(this.capabilities, offset++)
		buffer.writeUInt8(this.assignment, offset)
		return buffer
	}
}
