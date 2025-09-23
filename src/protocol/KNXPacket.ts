/**
 * Represents generic KNX packets and serialization helpers.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import KNXHeader from './KNXHeader'

export default class KNXPacket {
	private _header: KNXHeader

	public type: number

	public length: number

	constructor(type: number, length: number) {
		this.type = type
		this.length = length
		this._header = new KNXHeader(type, length)
		this.type = type
		this.length = length
	}

	get header(): KNXHeader {
		return this._header
	}

	toBuffer(): Buffer {
		return Buffer.alloc(0)
	}
}
