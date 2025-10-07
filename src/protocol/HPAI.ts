/**
 * Implements the KNX Host Protocol Address Information structure.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { KNX_CONSTANTS } from './KNXConstants'
import KNXHeader from './KNXHeader'

const HPAI_STRUCTURE_LENGTH: number = 8

export enum KnxProtocol {
	IPV4_UDP = KNX_CONSTANTS.IPV4_UDP,
	IPV4_TCP = KNX_CONSTANTS.IPV4_TCP,
}

export default class HPAI {
	private _port: number

	private _protocol: KnxProtocol

	private _host: string

	private _splitHost: RegExpMatchArray

	private _header: KNXHeader

	constructor(
		_host: string,
		_port: number = KNX_CONSTANTS.KNX_PORT,
		_protocol: KnxProtocol = KnxProtocol.IPV4_UDP,
	) {
		this._port = _port
		this._protocol = _protocol
		this.host = _host
	}

	set protocol(proto: KnxProtocol) {
		this._protocol = proto
	}

	get protocol(): KnxProtocol {
		return this._protocol
	}

	set port(port: number) {
		if (
			isNaN(port) ||
			typeof port !== 'number' ||
			port < 0 ||
			port > 65535
		) {
			throw new Error(`Invalid port ${port}`)
		}
		this._port = port
	}

	get port(): number {
		return this._port
	}

	get header(): any {
		return this._header
	}

	set host(host: string) {
		if (host == null) {
			throw new Error('Host undefined')
		}
		const m = host.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)/)
		if (m === null) {
			throw new Error(`Invalid host format - ${host}`)
		}
		this._host = host
		this._splitHost = m
	}

	get host(): string {
		return this._host
	}

	get length(): number {
		return HPAI_STRUCTURE_LENGTH
	}

	static get NULLHPAI(): HPAI {
		const NULLHPAI = new HPAI('0.0.0.0', 0)
		return NULLHPAI
	}

	static createFromBuffer(buffer: Buffer, offset: number = 0): HPAI {
		if (offset >= buffer.length) {
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
		const protocol = buffer.readUInt8(offset)
		offset += 1
		const ip = []
		for (let i = 1; i <= 4; i++) {
			ip.push(buffer.readUInt8(offset))
			offset += 1
		}
		const port = buffer.readUInt16BE(offset)
		const host = ip.join('.')
		return new HPAI(host, port, protocol)
	}

	toBuffer(): Buffer {
		const buffer = Buffer.alloc(this.length)
		let offset = 0
		buffer.writeUInt8(this.length, offset)
		offset += 1
		buffer.writeUInt8(this.protocol, offset)
		offset += 1
		for (let i = 1; i <= KNX_CONSTANTS.IPV4_ADDRESS_LENGTH; i++) {
			buffer.writeUInt8(Number(this._splitHost[i]), offset)
			offset += 1
		}
		buffer.writeUInt16BE(this.port, offset)
		return buffer
	}
}
