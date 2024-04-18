import CEMIMessage from './CEMIMessage'
import CEMIConstants from './CEMIConstants'
import KNXAddress from '../KNXAddress'
import ControlField from './ControlField'
import NPDU from './NPDU'
import KNXDataBuffer from '../KNXDataBuffer'

export default class LDataInd extends CEMIMessage {
	additionalInfo: KNXDataBuffer | null

	control: ControlField

	srcAddress: KNXAddress

	dstAddress: KNXAddress

	npdu: NPDU

	constructor(
		additionalInfo: KNXDataBuffer | null,
		control: ControlField,
		srcAddress: KNXAddress,
		dstAddress: KNXAddress,
		npdu: NPDU,
	) {
		super(
			CEMIConstants.L_DATA_IND,
			CEMIMessage.GetLength(
				additionalInfo,
				control,
				srcAddress,
				dstAddress,
				npdu,
			),
			additionalInfo,
			control,
			srcAddress,
			dstAddress,
			npdu,
		)
		this.additionalInfo = additionalInfo
		this.control = control
		this.srcAddress = srcAddress
		this.dstAddress = dstAddress
		this.npdu = npdu
	}

	static createFromBuffer(buffer: Buffer, offset: number = 0): LDataInd {
		if (offset >= buffer.length) {
			throw new Error('Buffer too short')
		}
		const addLength = buffer.readUInt8(offset++)
		let additionalInfo = null
		if (addLength > 0) {
			additionalInfo = new KNXDataBuffer(
				buffer.subarray(offset, addLength),
			)
			offset += addLength
		}
		const controlField = ControlField.createFromBuffer(buffer, offset)
		offset += controlField.length
		const srcAddress = KNXAddress.createFromBuffer(buffer, offset)
		offset += srcAddress.length
		const dstAddress = KNXAddress.createFromBuffer(
			buffer,
			offset,
			controlField.addressType,
		)
		offset += dstAddress.length
		const npdu = NPDU.createFromBuffer(buffer, offset)
		return new LDataInd(
			additionalInfo,
			controlField,
			srcAddress,
			dstAddress,
			npdu,
		)
	}

	toBuffer(): Buffer {
		const buffer = Buffer.alloc(2)
		const msgBuffer: Buffer[] = [buffer]
		let offset = 0
		buffer.writeUInt8(this.msgCode, offset++)
		if (this.additionalInfo == null) {
			buffer.writeUInt8(0, offset)
		} else {
			buffer.writeUInt8(this.additionalInfo.length, offset)
			msgBuffer.push(this.additionalInfo.value)
		}
		msgBuffer.push(this.control.toBuffer())
		msgBuffer.push(this.srcAddress.toBuffer())
		msgBuffer.push(this.dstAddress.toBuffer())
		msgBuffer.push(this.npdu.toBuffer())
		return Buffer.concat(msgBuffer)
	}
}
