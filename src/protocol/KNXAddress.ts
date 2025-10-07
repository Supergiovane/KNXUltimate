/**
 * Encapsulates a KNX address with parsing helpers.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { Parser } from 'binary-parser'
import { validateKNXAddress } from './KNXUtils'

const threeLevelPhysical = new Parser().bit4('l1').bit4('l2').uint8('l3')
const threeLevelGroup = new Parser().bit5('l1').bit3('l2').uint8('l3')
const twoLevel = new Parser().bit5('l1').bit11('l2')

const ADDRESS_LENGTH = 2

export enum KNXAddressType {
	TYPE_INDIVIDUAL = 0,
	TYPE_GROUP = 1,
}

export enum KNXAddressLevel {
	LEVEL_TWO = 2,
	LEVEL_THREE = 3,
}

export default class KNXAddress {
	private _address: number

	private type: KNXAddressType

	private level: KNXAddressLevel

	public length: number

	constructor(
		address: number,
		type: KNXAddressType = KNXAddressType.TYPE_INDIVIDUAL,
		level: KNXAddressLevel = KNXAddressLevel.LEVEL_THREE,
	) {
		this.type = type
		this.level = level
		this.set(address)
		this.length = 2
	}

	static get TYPE_INDIVIDUAL(): KNXAddressType {
		return KNXAddressType.TYPE_INDIVIDUAL
	}

	static get TYPE_GROUP(): KNXAddressType {
		return KNXAddressType.TYPE_GROUP
	}

	static createFromString(
		address: string | number,
		type: KNXAddressType = KNXAddressType.TYPE_INDIVIDUAL,
	): KNXAddress {
		return new KNXAddress(
			validateKNXAddress(address, type === KNXAddressType.TYPE_GROUP),
			type,
		)
	}

	static createFromBuffer(
		buffer: Buffer,
		offset: number = 0,
		type: KNXAddressType = KNXAddressType.TYPE_INDIVIDUAL,
	): KNXAddress {
		if (offset + 2 > buffer.length) {
			throw new Error(
				`offset ${offset} out of buffer range ${buffer.length}`,
			)
		}
		const address = buffer.readUInt16BE(offset)
		return new KNXAddress(address, type)
	}

	set(address: number): void {
		if (isNaN(address)) {
			throw new Error('Invalid address format')
		} else if (address > 0xffff) {
			throw new Error('Invalid address number')
		} else {
			this._address = address
		}
	}

	get(): number {
		return this._address
	}

	toString(): string {
		let address = ''
		const buf = Buffer.alloc(2)
		buf.writeUInt16BE(this._address)

		if (
			this.type === KNXAddressType.TYPE_GROUP &&
			this.level === KNXAddressLevel.LEVEL_TWO
		) {
			// 2 level group
			const addr = twoLevel.parse(buf)
			address = [addr.l1, addr.l2].join('/')
		} else {
			// 3 level physical or group address
			const sep = this.type === KNXAddressType.TYPE_GROUP ? '/' : '.'
			const addr = (
				this.type === KNXAddressType.TYPE_GROUP
					? threeLevelGroup
					: threeLevelPhysical
			).parse(buf)
			address = [addr.l1, addr.l2, addr.l3].join(sep)
		}

		return address
	}

	toBuffer(): Buffer {
		const buffer = Buffer.alloc(this.length)
		buffer.writeUInt16BE(this._address, 0)
		return buffer
	}
}
