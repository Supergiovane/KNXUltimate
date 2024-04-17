import TLVInfo from './TLVInfo'

export default class AdditionalInfo {
	_tlvs: TLVInfo[]

	_length: number

	constructor(_tlvs = []) {
		this._tlvs = _tlvs
		this._length = 0
		for (const tlv of _tlvs) {
			this._length += tlv.length
		}
	}

	static createFromBuffer(buffer: Buffer, offset = 0) {
		const tlvs = []
		const _getOneTLV = () => {
			if (offset >= buffer.length) {
				return tlvs
			}
			const tlv = TLVInfo.createFromBuffer(buffer, offset)
			tlvs.push(tlv)
			offset += tlv.length
			return _getOneTLV()
		}
		return new AdditionalInfo(_getOneTLV())
	}

	addTLV(tlv) {
		this._tlvs.push(tlv)
	}

	toBuffer() {
		return Buffer.concat(this._tlvs.map((tlv) => tlv.toBuffer()))
	}
}
