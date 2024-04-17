import KNXPacket from "./KNXPacket";
import HPAI from "./HPAI";
import { KNX_CONSTANTS } from "./KNXConstants";

export default class KNXDisconnectRequest extends KNXPacket {
  channelID: number;
  hpaiControl: HPAI;

  constructor(channelID: number, hpaiControl: HPAI = HPAI.NULLHPAI) {
    super(KNX_CONSTANTS.DISCONNECT_REQUEST, hpaiControl.length + 2);
    this.channelID = channelID;
    this.hpaiControl = hpaiControl;
  }

  static createFromBuffer(
    buffer: Buffer,
    offset: number = 0
  ): KNXDisconnectRequest {
    if (offset >= buffer.length) {
      throw new Error("Buffer too short");
    }
    const channelID = buffer.readUInt8(offset++);
    offset++;
    const hpaiControl = HPAI.createFromBuffer(buffer, offset);
    return new KNXDisconnectRequest(channelID, hpaiControl);
  }

  toBuffer(): Buffer {
    const buffer = Buffer.alloc(2);
    buffer.writeUInt8(this.channelID, 0);
    buffer.writeUInt8(0, 1);
    return Buffer.concat([
      this.header.toBuffer(),
      buffer,
      this.hpaiControl.toBuffer(),
    ]);
  }
}
