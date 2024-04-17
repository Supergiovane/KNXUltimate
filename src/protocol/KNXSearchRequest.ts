import { KNX_CONSTANTS } from './KNXConstants';
import  KNXPacket from './KNXPacket';
import  HPAI  from './HPAI';

export default class KNXSearchRequest extends KNXPacket {
  hpai: HPAI;

  constructor(hpai: HPAI) {
    super(KNX_CONSTANTS.SEARCH_REQUEST, hpai.length);
    this.hpai = hpai;
  }

  static createFromBuffer(buffer: Buffer, offset: number = 0): KNXSearchRequest {
    if (offset >= buffer.length) {
      throw new Error('Buffer too short');
    }
    const hpai = HPAI.createFromBuffer(buffer, offset);
    return new KNXSearchRequest(hpai);
  }

  toBuffer(): Buffer {
    return Buffer.concat([this.header.toBuffer(), this.hpai.toBuffer()]);
  }
}