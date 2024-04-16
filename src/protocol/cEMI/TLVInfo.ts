
export default class TLVInfo {
  type: number;
  length: number;
  info: Buffer;

  constructor(type: number, length: number, info: Buffer) {
    this.type = type;
    this.length = length;
    this.info = info;
  }

  static createFromBuffer(buffer: Buffer, offset: number = 0): TLVInfo {
    const type: number = buffer.readUInt8(offset++);
    const length: number = buffer.readUInt8(offset++);
    const info: Buffer = Buffer.alloc(length);
    for (let i: number = 0; i < length; i++) {
      info.writeUInt8(buffer.readUInt8(offset++), i);
    }
    return new TLVInfo(type, length, info);
  }

  toBuffer(): Buffer {
    const buffer: Buffer = Buffer.alloc(2);
    buffer.writeUInt8(this.type, 0);
    buffer.writeUInt8(this.length, 1);
    return Buffer.concat([buffer, this.info]);
  }
}