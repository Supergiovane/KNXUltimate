import { KNXPacket } from "./KNXPacket";
import { KNX_CONSTANTS } from "./KNXConstants";
import HPAI from "./HPAI";

export class KNXConnectionStateRequest extends KNXPacket {
  channelID: number;
  hpaiControl: HPAI;

  constructor(channelID: number, hpaiControl: HPAI | string = HPAI.NULLHPAI) {
    super(KNX_CONSTANTS.CONNECTIONSTATE_REQUEST, hpaiControl.length + 2);
    this.channelID = channelID;
    this.hpaiControl =
      typeof hpaiControl === "string" ? new HPAI(hpaiControl) : hpaiControl;
  }

  static createFromBuffer(
    buffer: Buffer,
    offset: number = 0
  ): KNXConnectionStateRequest {
    if (offset >= buffer.length) {
      throw new Error("Buffer too short");
    }
    const channelID = buffer.readUInt8(offset++);
    offset++;
    const hpaiControl = HPAI.createFromBuffer(buffer, offset);
    return new KNXConnectionStateRequest(channelID, hpaiControl);
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
