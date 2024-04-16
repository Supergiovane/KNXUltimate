import KNXAddress from "../KNXAddress";
import ControlField from "./ControlField";
import NPDU from "./NPDU";

export default class CEMIMessage {
  msgCode: number;
  length: number;
  additionalInfo: Buffer | null;
  control: ControlField;
  srcAddress: KNXAddress;
  dstAddress: KNXAddress;
  npdu: NPDU;

  constructor(msgCode: number, length: number, additionalInfo?: Buffer, control?: ControlField, srcAddress?: KNXAddress, dstAddress?: KNXAddress, npdu?: NPDU) {
    this.msgCode = msgCode;
    this.length = length;
    this.additionalInfo = additionalInfo;
    this.control = control;
    this.srcAddress = srcAddress;
    this.dstAddress = dstAddress;
    this.npdu = npdu;
  }

  toBuffer(): Buffer {
    const buffer = Buffer.alloc(2);
    buffer.writeUInt8(this.msgCode, 0);
    const len = this.additionalInfo == null ? 0 : this.additionalInfo.length;
    buffer.writeUInt8(len, 1);
    if (this.additionalInfo) {
      return Buffer.concat([buffer, this.additionalInfo]);
    }
    return buffer;
  }

  static GetLength(additionalInfo: Buffer | null, control: ControlField, srcAddress: KNXAddress, dstAddress: KNXAddress, npdu: NPDU): number {
    const length = additionalInfo === null ? 1 : additionalInfo.length;
    const npduLength = npdu == null ? 0 : npdu.length;
    return 1 + length + control.length + srcAddress.length + dstAddress.length + npduLength;
  }
}