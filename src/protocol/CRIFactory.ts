import { KNX_CONSTANTS } from './KNXConstants';
import TunnelCRI from './TunnelCRI';

export default class CRIFactory {
  static createFromBuffer(buffer: Buffer, offset: number): any {
    if (offset >= buffer.length) {
      throw new Error('Buffer too short');
    }
    const structureLength: number = buffer.readUInt8(offset);
    if (offset + structureLength > buffer.length) {
      throw new Error('Buffer too short');
    }
    offset += 1;
    const connectionType: number = buffer.readUInt8(offset++);
    switch (connectionType) {
      case KNX_CONSTANTS.TUNNEL_CONNECTION:
        return TunnelCRI.createFromBuffer(buffer, offset);
    }
  }
}