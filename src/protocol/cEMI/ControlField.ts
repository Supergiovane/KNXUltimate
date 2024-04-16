import { KNXAddressType } from "../KNXAddress";

export enum FrameType {
  type0 = 0,
  type1 = 1
}

export enum OnOff {
  off = 0,
  on = 1
}

export enum Priority {
  Prio0 = 0,
  Prio1 = 1,
  Prio2 = 2,
  Prio3 = 3
}

const CONTROL_LENGTH = 2

export default class ControlField {
  private control1: number;
  private control2: number;
  public length: number;

  constructor(control1: number = ControlField.DEFAULT_CONTROL1, control2: number = ControlField.DEFAULT_CONTROL2) {
    this.control1 = control1;
    this.control2 = control2;
    this.length = CONTROL_LENGTH;
  }

  set frameType(frameType: FrameType) {
    this.control1 = (this.control1 & 0x7F) | (Number(frameType) << 7);
  }

  get frameType(): FrameType {
    return (this.control1 & 0x80) >> 7;
  }

  set repeat(repeat: OnOff) {
    this.control1 = (this.control1 & 0xDF) | (Number(repeat) << 5);
  }

  get repeat(): OnOff {
    return (this.control1 & 0x20) >> 5;
  }

  set broadcast(broadcast: OnOff) {
    this.control1 = (this.control1 & 0xEF) | (Number(broadcast) << 4);
  }

  get broadcast(): OnOff {
    return (this.control1 & 0x10) >> 4;
  }

  set priority(priority: Priority) {
    this.control1 = (this.control1 & 0xF3) | (Number(priority) << 2);
  }

  get priority(): Priority {
    return (this.control1 & 0x0C) >> 2;
  }

  set ack(ack: OnOff) {
    this.control1 = (this.control1 & 0xFD) | (Number(ack) << 1);
  }

  get ack(): OnOff {
    return (this.control1 & 0x02) >> 1;
  }

  set error(error: OnOff) {
    this.control1 = (this.control1 & 0xFE) | Number(error);
  }

  get error(): OnOff {
    return this.control1 & 0x01;
  }

  set addressType(type: KNXAddressType) {
    this.control2 = (this.control2 & 0x7F) | (Number(type) << 7);
  }

  get addressType(): KNXAddressType {
    return (this.control2 & 0x80) >> 7;
  }

  set hopCount(hopCount: number) {
    if (isNaN(hopCount) || (hopCount < 0 && hopCount > 7)) {
      throw new Error('Invalid hop count');
    }
    this.control2 = (this.control2 & 0x8F) | (Number(hopCount) << 4);
  }

  get hopCount(): number {
    return (this.control2 & 0x70) >> 4;
  }

  set frameFormat(format: number) {
    if (isNaN(format) || (format < 0 && format > 15)) {
      throw new Error('Invalid frame format');
    }
    this.control2 = (this.control2 & 0xF0) | Number(format);
  }

  get frameFormat(): number {
    return this.control2 & 0xF;
  }

  static get DEFAULT_CONTROL1(): number {
    return 0xBE;
  }

  static get DEFAULT_CONTROL2(): number {
    return 0xE0;
  }

  static createFromBuffer(buffer: Buffer, offset: number = 0): ControlField {
    if (offset + CONTROL_LENGTH >= buffer.length) {
      throw new Error(`offset ${offset} out of buffer range ${buffer.length}`);
    }
    const control1 = buffer.readUInt8(offset++);
    const control2 = buffer.readUInt8(offset);
    return new ControlField(control1, control2);
  }

  toBuffer(): Buffer {
    const buffer = Buffer.alloc(this.length);
    buffer.writeUInt8(this.control1, 0);
    buffer.writeUInt8(this.control2, 1);
    return buffer;
  }
}

