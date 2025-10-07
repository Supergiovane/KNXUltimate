/**
 * Defines the KNX packet header structure.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { Buffer } from 'buffer'
import { KNX_CONSTANTS } from './KNXConstants'
import { module } from '../KnxLog'

const logger = module('KNXHeader')

export default class KNXHeader {
	private _headerLength: number

	private _version: number

	public service_type: number

	public length: number

	constructor(type: number, length: number) {
		this._headerLength = KNX_CONSTANTS.HEADER_SIZE_10
		this._version = KNX_CONSTANTS.KNXNETIP_VERSION_10
		this.service_type = type
		this.length = KNX_CONSTANTS.HEADER_SIZE_10 + length
	}

	get headerLength(): number {
		return this._headerLength
	}

	get version(): number {
		return this._version
	}

	static createFromBuffer(buffer: Buffer, offset: number = 0): KNXHeader {
		if (buffer.length < KNX_CONSTANTS.HEADER_SIZE_10) {
			logger.error(
				`createFromBuffer: incomplete buffer. Buffer length: ${buffer.length} expected HEADER_SIZE_10 equals to ${KNX_CONSTANTS.HEADER_SIZE_10}`,
			)
			throw new Error('Incomplete buffer')
		}
		const header_length = buffer.readUInt8(offset)
		if (header_length !== KNX_CONSTANTS.HEADER_SIZE_10) {
			logger.error(
				`createFromBuffer: invalid header_length. header_length: ${header_length} expected HEADER_SIZE_10 equals to ${KNX_CONSTANTS.HEADER_SIZE_10}`,
			)
			throw new Error(`Invalid buffer length ${header_length}`)
		}
		offset += 1
		const version = buffer.readUInt8(offset)
		if (version !== KNX_CONSTANTS.KNXNETIP_VERSION_10) {
			logger.error(
				`createFromBuffer: Unknown header version. Version: ${version} expected KNXNETIP_VERSION_10 to ${KNX_CONSTANTS.KNXNETIP_VERSION_10}`,
			)
			throw new Error(`Unknown version ${version}`)
		}
		offset += 1
		const type = buffer.readUInt16BE(offset)
		offset += 2
		const length = buffer.readUInt16BE(offset)
		if (length !== buffer.length) {
			logger.error(
				`Received KNX packet: createFromBuffer: Message length mismatch ${length}/${buffer.length} Data processed: ${buffer.toString('hex') || '??'}`,
			)
			// throw new Error(`Message length mismatch ${length}/${buffer.length} Data processed: ${buffer.toString("hex") || "??"}`);
		}
		return new KNXHeader(type, length - header_length)
	}

	toBuffer(): Buffer {
		const buffer = Buffer.alloc(this._headerLength)
		let offset = 0
		buffer.writeUInt8(this._headerLength, offset)
		offset += 1
		buffer.writeUInt8(this._version, offset)
		offset += 1
		buffer.writeUInt16BE(this.service_type, offset)
		offset += 2
		buffer.writeUInt16BE(this.length, offset)
		return buffer
	}
}
