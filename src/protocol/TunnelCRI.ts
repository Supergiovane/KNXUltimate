import { KNX_CONSTANTS } from './KNXConstants';
import CRI from './CRI';

const TUNNEL_CRI_LENGTH: number = 4;

export enum TunnelTypes {
  TUNNEL_LINKLAYER = KNX_CONSTANTS.TUNNEL_LINKLAYER,
  TUNNEL_RAW = KNX_CONSTANTS.TUNNEL_RAW,
  TUNNEL_BUSMONITOR = KNX_CONSTANTS.TUNNEL_BUSMONITOR
}

export default class TunnelCRI extends CRI {
  private knxLayer: number;
  static TunnelTypes: any;
  static TunnelCRI: any;

  constructor(knxLayer: number) {
    super(KNX_CONSTANTS.TUNNEL_CONNECTION);
    this.knxLayer = knxLayer;
  }

  get length(): number {
    return TUNNEL_CRI_LENGTH;
  }

  static createFromBuffer(buffer: Buffer, offset: number = 0): TunnelCRI {
    const knxLayer: number = buffer.readUInt8(offset++);
    buffer.readUInt8(offset);
    return new TunnelCRI(knxLayer);
  }

  toBuffer(): Buffer {
    const buffer: Buffer = Buffer.alloc(this.length);
    let offset: number = 0;
    buffer.writeUInt8(this.length, offset++);
    buffer.writeUInt8(KNX_CONSTANTS.TUNNEL_CONNECTION, offset++);
    buffer.writeUInt8(this.knxLayer, offset++);
    buffer.writeUInt8(0x00, offset);
    return buffer;
  }
}
