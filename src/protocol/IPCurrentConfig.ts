/**
 * Represents KNX current IP configuration response blocks.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { splitIP } from './KNXUtils'
import { KNX_CONSTANTS } from './KNXConstants'

const IP_CURRENT_CONFIG_LENGTH: number = 20

export default class IPCurrentConfig {
	private _type: number = KNX_CONSTANTS.IP_CONFIG

	private _splitIP: RegExpMatchArray

	private _splitMask: RegExpMatchArray

	private _splitGateway: RegExpMatchArray

	private _splitDhcpServer: RegExpMatchArray

	constructor(
		private _ip: string,
		private _mask: string,
		private _gateway: string,
		private _dhcpServer: string,
		private _assignment: number,
	) {
		this._splitIP = splitIP(_ip)
		this._splitMask = splitIP(_mask, 'mask')
		this._splitGateway = splitIP(_gateway, 'gateway')
		this._splitDhcpServer = splitIP(_dhcpServer, 'dhcpServer')
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

	get gateway(): string {
		return this._splitGateway.join('.')
	}

	set dhcpServer(dhcpServer: string) {
		this._splitDhcpServer = splitIP(dhcpServer, 'dhcpServer')
	}

	get dhcpServer(): string {
		return this._splitDhcpServer.join('.')
	}

	get length(): number {
		return IP_CURRENT_CONFIG_LENGTH
	}

	static createFromBuffer(
		buffer: Buffer,
		offset: number = 0,
	): IPCurrentConfig {
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
		const dhcpServer: number[] = []
		for (let i = 1; i <= 4; i++) {
			dhcpServer.push(buffer.readUInt8(offset++))
		}
		const textDhcpServer: string = dhcpServer.join('.')
		const assignment: number = buffer.readUInt8(offset)
		return new IPCurrentConfig(
			textIP,
			textMask,
			textGateway,
			textDhcpServer,
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
		for (let i = 1; i <= KNX_CONSTANTS.IPV4_ADDRESS_LENGTH; i++) {
			buffer.writeUInt8(Number(this._splitDhcpServer[i]), offset++)
		}
		buffer.writeUInt8(this._assignment, offset)
		return buffer
	}
}

export { IPCurrentConfig }
