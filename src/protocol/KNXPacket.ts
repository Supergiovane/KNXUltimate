import KNXHeader from './KNXHeader';

export default class KNXPacket {
  private _header: KNXHeader;
  public type: number;
  public length: number;

  constructor(type: number, length: number) {
    this.type = type;
    this.length = length;
    this._header = new KNXHeader(type, length);
    this.type = type;
    this.length = length;
  }

  get header(): KNXHeader {
    return this._header;
  }

  toBuffer(): Buffer {
    return Buffer.alloc(0);
  }
}