/**
 * Factory for creating KNX cEMI messages.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import CEMIConstants from './CEMIConstants'
import LDataInd from './LDataInd'
import LDataCon from './LDataCon'
import LDataReq from './LDataReq'
import ControlField from './ControlField'
import NPDU from './NPDU'
import KNXAddress from '../KNXAddress'
import KNXDataBuffer from '../KNXDataBuffer'

export default class CEMIFactory {
	static createFromBuffer(type: number, buffer: Buffer, offset: number): any {
		switch (type) {
			case CEMIConstants.L_DATA_IND:
				return LDataInd.createFromBuffer(buffer, offset)
			case CEMIConstants.L_DATA_CON:
				return LDataCon.createFromBuffer(buffer, offset)
			case CEMIConstants.L_DATA_REQ:
				return LDataReq.createFromBuffer(buffer, offset)
			default:
				throw new Error(`Unsupported type cEMI message type ${type}`)
		}
	}

	static newLDataRequestMessage(
		requestType: string,
		srcAddress: KNXAddress,
		dstAddress: KNXAddress,
		data: KNXDataBuffer,
	) {
		const controlField = new ControlField()

		const npdu = new NPDU()
		npdu.tpci = NPDU.TPCI_UNUMBERED_PACKET

		if (requestType === 'write') npdu.action = NPDU.GROUP_WRITE
		if (requestType === 'response') npdu.action = NPDU.GROUP_RESPONSE
		if (requestType === 'read') npdu.action = NPDU.GROUP_READ

		npdu.data = data
		return new LDataReq(null, controlField, srcAddress, dstAddress, npdu)
	}

	static newLDataIndicationMessage(
		requestType: string,
		srcAddress: KNXAddress,
		dstAddress: KNXAddress,
		data: KNXDataBuffer,
	) {
		const controlField = new ControlField()

		const npdu = new NPDU()
		npdu.tpci = NPDU.TPCI_UNUMBERED_PACKET

		if (requestType === 'write') npdu.action = NPDU.GROUP_WRITE
		if (requestType === 'response') npdu.action = NPDU.GROUP_RESPONSE
		if (requestType === 'read') npdu.action = NPDU.GROUP_READ

		npdu.data = data
		return new LDataInd(null, controlField, srcAddress, dstAddress, npdu)
	}
}
