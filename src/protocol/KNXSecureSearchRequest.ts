import { KNX_CONSTANTS } from './KNXConstants'
import KNXPacket from './KNXPacket'
import HPAI from './HPAI'

export default class KNXSecureSearchRequest extends KNXPacket {
    hpai: HPAI
    private _srp: Buffer

    constructor(hpai: HPAI, dibs: number[] = [
        KNX_CONSTANTS.DEVICE_INFO,
        KNX_CONSTANTS.SUPP_SVC_FAMILIES,
        KNX_CONSTANTS.SECURED_SERVICE_FAMILIES,
    ]) {
        // Actually SEARCH_REQUEST_EXTENDED (0x020B)
        const srpDibs = KNXSecureSearchRequest.buildRequestDibsSRP(dibs)
        const srpSvc = KNXSecureSearchRequest.buildSelectByServiceSRP(0x09 /* SECURITY */, 0x01)
        const srp = Buffer.concat([srpSvc, srpDibs])
        super(KNX_CONSTANTS.SEARCH_REQUEST_EXTENDED, hpai.length + srp.length)
        this.hpai = hpai
        this._srp = srp
    }

    static buildRequestDibsSRP(dibs: number[]): Buffer {
        const payload = Buffer.from(dibs)
        const padded = payload.length % 2 === 1
            ? Buffer.concat([payload, Buffer.from([0x00])])
            : payload
        const len = 2 + padded.length
        const buf = Buffer.alloc(len)
        let off = 0
        buf.writeUInt8(len, off++)
        // mandatory bit 0, type REQUEST_DIBS (0x04)
        buf.writeUInt8(0x04, off++)
        padded.copy(buf, off)
        return buf
    }

    static buildSelectByServiceSRP(family: number, minVersion: number): Buffer {
        // SRP SELECT_BY_SERVICE: length=4, byte1 flags+type with mandatory=1 and type=0x03
        // data payload: [family, minVersion]
        const len = 2 + 2
        const buf = Buffer.alloc(len)
        buf.writeUInt8(len, 0)
        buf.writeUInt8(0x80 | 0x03, 1) // mandatory bit set | type 0x03
        buf.writeUInt8(family & 0xff, 2)
        buf.writeUInt8(minVersion & 0xff, 3)
        return buf
    }

	static createFromBuffer(
		buffer: Buffer,
		offset: number = 0,
	): KNXSecureSearchRequest {
		if (offset >= buffer.length) {
			throw new Error('Buffer too short')
		}
        const hpai = HPAI.createFromBuffer(buffer, offset)
        return new KNXSecureSearchRequest(hpai)
	}

	toBuffer(): Buffer {
		return Buffer.concat([this.header.toBuffer(), this.hpai.toBuffer(), this._srp])
	}
}
