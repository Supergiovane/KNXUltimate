import { KNXPacket } from './KNXPacket';
import HPAI from './HPAI';
import CRIFactory from './CRIFactory';
import { KNX_CONSTANTS } from './KNXConstants';
import KNXHeader from './KNXHeader';

export class KNXConnectRequest extends KNXPacket {
  cri: CRIFactory;
  hpaiControl: HPAI;
  hpaiData: HPAI;
  header: KNXHeader;

  constructor(cri: CRIFactory, hpaiControl: HPAI = HPAI.NULLHPAI, hpaiData: HPAI = HPAI.NULLHPAI) {
    super(KNX_CONSTANTS.CONNECT_REQUEST, hpaiControl.length + hpaiData.length + cri.length);
    this.cri = cri;
    this.hpaiControl = hpaiControl;
    this.hpaiData = hpaiData;
  }

  static createFromBuffer(buffer: Buffer, offset: number = 0): KNXConnectRequest {
    if (offset >= buffer.length) {
      throw new Error('Buffer too short');
    }
    const hpaiControl = HPAI.createFromBuffer(buffer, offset);
    offset += hpaiControl.length;
    const hpaiData = HPAI.createFromBuffer(buffer, offset);
    offset += hpaiData.length;
    const cri = CRIFactory.createFromBuffer(buffer, offset);
    return new KNXConnectRequest(cri, hpaiControl, hpaiData);
  }

  toBuffer(): Buffer {
    return Buffer.concat([
      this.header.toBuffer(),
      this.hpaiControl.toBuffer(),
      this.hpaiData.toBuffer(),
      this.cri.toBuffer()
    ]);
  }
}