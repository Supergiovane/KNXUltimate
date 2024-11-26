import KNXDataBuffer from '../KNXDataBuffer'
import CEMIConstants from './CEMIConstants'
import { module } from '../../KnxLog'

// 08/04/2021 new logger to adhere to the loglevel selected in the config-window

const logger = module('NPDU')

export default class NPDU {
	private _tpci: number

	private _apci: number

	private _data: KNXDataBuffer | null

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

	get length(): number {
		if (this._data === null) {
			return 3
		}
		return 3 + this._data.length
	}

	get action(): number {
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
		try {
			apci = buffer.readUInt8(offset++)
		} catch (error) {
			sysLogger.error(`createFromBuffer: error apci: ${error.message}`)
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
