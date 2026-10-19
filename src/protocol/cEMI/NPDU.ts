/**
 * Implements the KNX NPDU payload handling.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import KNXDataBuffer from '../KNXDataBuffer'
import CEMIConstants from './CEMIConstants'
import { module } from '../../KnxLog'

// 08/04/2021 new logger to adhere to the loglevel selected in the config-window

const logger = module('NPDU')

export default class NPDU {
	private _tpci: number

	private _apci: number

	private _data: KNXDataBuffer | null

	// Transport control TPDU (T_Connect, T_Disconnect, T_ACK, T_NAK): only the
	// TPCI octet, cEMI length L = 0, no APCI (ISO 22510 Annex D.1.1.5.3, as XKNX)
	private _transportControl = false

	constructor(
		_tpci: number = 0x0,
		_apci: number = 0x0,
		_data: KNXDataBuffer | null = null,
	) {
		this._tpci = _tpci
		this._apci = _apci
		this._data = _data
	}

	set tpci(tpci: number) {
		if (isNaN(tpci) || (tpci < 0 && tpci > 0xff)) {
			throw new Error('Invalid TPCI')
		}
		this._tpci = tpci
	}

	get tpci(): number {
		return this._tpci
	}

	set apci(apci: number) {
		if (isNaN(apci) || (apci < 0 && apci > 0xff)) {
			throw new Error('Invalid APCI')
		}
		this._apci = apci
		this._transportControl = false
	}

	get apci(): number {
		return this._apci
	}

	get dataBuffer(): KNXDataBuffer | null {
		return this._data
	}

	get dataValue(): Buffer {
		if (this._data == null) {
			const val = this.apci & 0x3f
			return Buffer.alloc(1, val)
		}
		return this._data.value
	}

	set data(data: KNXDataBuffer | null) {
		if (data == null) {
			this._data = null
			return
		}
		if (!(data instanceof KNXDataBuffer)) {
			throw new Error('Invalid data Buffer')
		}
		this._transportControl = false

		if (
			data.sixBits() &&
			data.length === 1 &&
			data.value.readUInt8(0) <= 0x3f
		) {
			this.apci = (this.apci & 0xc0) | data.value.readUInt8(0)
			this._data = null
			return
		}

		this._data = data
	}

	/** True for a TPCI-only frame (T_Connect, T_Disconnect, T_ACK, T_NAK) */
	get isTransportControl(): boolean {
		return this._transportControl
	}

	get length(): number {
		if (this._transportControl) {
			return 2
		}
		if (this._data === null) {
			return 3
		}
		return 3 + this._data.length
	}

	get action(): number {
		// No APCI: never report a control TPDU as a group service
		if (this._transportControl) {
			return -1
		}
		return ((this.apci & 0xc0) >> 6) | ((this.tpci & 0x3) << 2)
	}

	set action(action: number) {
		this.tpci = (action & 0xc) << 4
		if (
			this.action === NPDU.GROUP_READ ||
			this.action >= NPDU.INDIVIDUAL_WRITE
		) {
			this.apci = (action & 0x3) << 6
		} else {
			this.apci = ((action & 0x3) << 6) | (this.apci & 0x3f)
		}
	}

	get isGroupRead(): boolean {
		return this.action === NPDU.GROUP_READ
	}

	get isGroupWrite(): boolean {
		return this.action === NPDU.GROUP_WRITE
	}

	get isGroupResponse(): boolean {
		return this.action === NPDU.GROUP_RESPONSE
	}

	static get GROUP_READ(): number {
		return CEMIConstants.GROUP_READ
	}

	static get GROUP_RESPONSE(): number {
		return CEMIConstants.GROUP_RESPONSE
	}

	static get GROUP_WRITE(): number {
		return CEMIConstants.GROUP_WRITE
	}

	static get INDIVIDUAL_WRITE(): number {
		return CEMIConstants.INDIVIDUAL_WRITE
	}

	static get INDIVIDUAL_READ(): number {
		return CEMIConstants.INDIVIDUAL_READ
	}

	static get INDIVIDUAL_RESPONSE(): number {
		return CEMIConstants.INDIVIDUAL_RESPONSE
	}

	static get TPCI_UNUMBERED_PACKET(): number {
		return CEMIConstants.TPCI_UNUMBERED_PACKET
	}

	/**
	 * Builds a transport control TPDU, e.g. 0x80 T_Connect, 0x81 T_Disconnect,
	 * 0xC2 | (seq << 2) T_ACK, 0xC3 | (seq << 2) T_NAK
	 */
	static createTransportControl(tpci: number): NPDU {
		const npdu = new NPDU(tpci, 0, null)
		npdu._transportControl = true
		return npdu
	}

	static createFromBuffer(buffer: Buffer, offset: number = 0): NPDU {
		const sysLogger = logger
		if (offset > buffer.length) {
			sysLogger.error('createFromBuffer: offset out of buffer range ')
			throw new Error(
				`offset ${offset}  out of buffer range ${buffer.length}`,
			)
		}
		let npduLength = null
		let tpci = null
		let apci = null
		let data = null

		try {
			npduLength = buffer.readUInt8(offset++)
		} catch (error) {
			sysLogger.error(
				`createFromBuffer: error npduLength: ${error.message}`,
			)
		}
		try {
			tpci = buffer.readUInt8(offset++)
		} catch (error) {
			sysLogger.error(`createFromBuffer: error tpci: ${error.message}`)
		}
		if (npduLength === 0 && tpci !== null) {
			// L = 0: no octet after the TPCI, so there is no APCI to read
			return NPDU.createTransportControl(tpci)
		}
		try {
			apci = buffer.readUInt8(offset++)
		} catch (error) {
			sysLogger.error(`createFromBuffer: error apci: ${error.message}`)
			throw error
		}
		try {
			data =
				npduLength > 1
					? buffer.subarray(offset, offset + npduLength - 1)
					: null
		} catch (error) {
			sysLogger.error(`createFromBuffer: error data: ${error.message}`)
		}
		return new NPDU(
			tpci,
			apci,
			data == null ? null : new KNXDataBuffer(data),
		)
	}

	toBuffer(): Buffer {
		if (this._transportControl) {
			return Buffer.from([0x00, this.tpci & 0xff])
		}
		const length = this._data == null ? 1 : this._data.length + 1
		const buffer = Buffer.alloc(3)
		buffer.writeUInt8(length, 0)
		buffer.writeUInt8(this.tpci, 1)
		buffer.writeUInt8(this.apci, 2)
		if (length === 1) {
			return buffer
		}
		return Buffer.concat([buffer, this._data.value])
	}
}
