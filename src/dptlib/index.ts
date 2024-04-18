/**
 * KNXEngine - a KNX protocol stack in Javascript
 * (C) 2020-2022 Supergiovane
 */

import * as util from 'util'
import KnxLog from '../KnxLog'
import { hasProp } from '../utils'

import DPT1 from './dpt1'
import DPT2 from './dpt2'
import DPT3 from './dpt3'
import DPT4 from './dpt4'
import DPT5 from './dpt5'
import DPT6 from './dpt6'
import DPT7 from './dpt7'
import DPT8 from './dpt8'
import DPT9 from './dpt9'
import DPT10 from './dpt10'
import DPT11 from './dpt11'
import DPT12 from './dpt12'
import DPT13 from './dpt13'
import DPT14 from './dpt14'
import DPT15 from './dpt15'
import DPT16 from './dpt16'
import DPT17 from './dpt17'
import DPT18 from './dpt18'
import DPT19 from './dpt19'
import DPT20 from './dpt20'
import DPT21 from './dpt21'
import DPT22 from './dpt22'
import DPT28 from './dpt28'
import DPT29 from './dpt29'
import DPT213 from './dpt213'
import DPT222 from './dpt222'
import DPT232 from './dpt232'
import DPT235 from './dpt235'
import DPT237 from './dpt237'
import DPT238 from './dpt238'
import DPT242 from './dpt242'
import DPT249 from './dpt249'
import DPT251 from './dpt251'
import DPT275 from './dpt275'
import DPT999 from './dpt999'
import DPT6001 from './dpt60001'

type Range = [number, number] | [undefined]

interface DatapointSubtype {
	scalar_range?: Range
	name: string
	use?: string
	desc?: string
	force_encoding?: string
	unit?: string
	enc?: Record<number, string>
	range?: Range
}

export interface DatapointConfig {
	id: string
	subtypeid?: string
	desc?: string
	basetype: {
		bitlength: number
		signedness?: string
		range?: Range
		valuetype: string
		desc?: string
		help?: string
		helplink?: string
	}
	subtype?: DatapointSubtype
	subtypes?: Record<string, DatapointSubtype>
	formatAPDU?: (value: any) => Buffer | void
	fromBuffer?: (buf: Buffer) => any
}

export const dpts: Record<string, DatapointConfig> = {
	[DPT1.id]: DPT1,
	[DPT2.id]: DPT2,
	[DPT3.id]: DPT3,
	[DPT4.id]: DPT4,
	[DPT5.id]: DPT5,
	[DPT6.id]: DPT6,
	[DPT7.id]: DPT7,
	[DPT8.id]: DPT8,
	[DPT9.id]: DPT9,
	[DPT10.id]: DPT10,
	[DPT11.id]: DPT11,
	[DPT12.id]: DPT12,
	[DPT13.id]: DPT13,
	[DPT14.id]: DPT14,
	[DPT15.id]: DPT15,
	[DPT16.id]: DPT16,
	[DPT17.id]: DPT17,
	[DPT18.id]: DPT18,
	[DPT19.id]: DPT19,
	[DPT20.id]: DPT20,
	[DPT21.id]: DPT21,
	[DPT22.id]: DPT22,
	[DPT28.id]: DPT28,
	[DPT29.id]: DPT29,
	[DPT213.id]: DPT213,
	[DPT222.id]: DPT222,
	[DPT232.id]: DPT232,
	[DPT235.id]: DPT235,
	[DPT237.id]: DPT237,
	[DPT238.id]: DPT238,
	[DPT242.id]: DPT242,
	[DPT249.id]: DPT249,
	[DPT251.id]: DPT251,
	[DPT275.id]: DPT275,
	[DPT999.id]: DPT999,
	[DPT6001.id]: DPT6001,
}

// a generic DPT resolution function
// DPTs might come in as 9/"9"/"9.001"/"DPT9.001"
export function resolve(dptid: string | number): DatapointConfig {
	const m = dptid
		.toString()
		.toUpperCase()
		.match(/^(?:DPT)?(\d+)(\.(\d+))?$/)
	if (m === null) throw Error(`Invalid DPT format: ${dptid}`)

	const dptkey = util.format('DPT%s', m[1])
	const dpt = dpts[dptkey]
	if (!dpt) throw Error(`Unsupported DPT: ${dptid}`)

	const cloned_dpt = cloneDpt(dpt)
	if (m[3]) {
		cloned_dpt.subtypeid = m[3]
		cloned_dpt.subtype = cloned_dpt.subtypes[m[3]]
	}

	return cloned_dpt
}
/* POPULATE an APDU object from a given Javascript value for the given DPT
 * - either by a custom DPT formatAPDU function
 * - or by this generic version, which:
 * --  1) checks if the value adheres to the range set from the DPT's bitlength
 *
 */

export type APDU = {
	bitlength: number
	data: Buffer
}

export function populateAPDU(value: any, apdu: APDU, dptid?: number | string) {
	// console.log ("BANANA " + dptid)
	const dpt = resolve(dptid || 'DPT1')
	const nbytes = Math.ceil(dpt.basetype.bitlength / 8)
	// apdu.data = new Buffer(nbytes); // 14/09/2020 Supregiovane: Deprecated. Replaced with below.
	apdu.data = Buffer.alloc(nbytes)
	apdu.bitlength = (dpt.basetype && dpt.basetype.bitlength) || 1
	let tgtvalue = value
	// get the raw APDU data for the given JS value
	if (typeof dpt.formatAPDU === 'function') {
		// nothing to do here, DPT-specific formatAPDU implementation will handle everything
		// knxLog.get().trace('>>> custom formatAPDU(%s): %j', dptid, value);
		// TODO: this could return void, what to do in that case?
		apdu.data = dpt.formatAPDU(value) as Buffer
		// knxLog.get().trace('<<< custom formatAPDU(%s): %j', dptid, apdu.data);
	} else {
		if (!isFinite(value)) {
			throw new Error(
				util.format('Invalid value, expected a %s', dpt.desc),
			)
		}
		// check if value is in range, be it explicitly defined or implied from bitlength
		const range = hasProp(dpt.basetype, 'range')
			? dpt.basetype.range
			: [0, 2 ** dpt.basetype.bitlength - 1]
		// is there a scalar range? eg. DPT5.003 angle degrees (0=0, ff=360)
		if (hasProp(dpt, 'subtype') && hasProp(dpt.subtype, 'scalar_range')) {
			const scalar = dpt.subtype.scalar_range
			if (value < scalar[0] || value > scalar[1]) {
				KnxLog.get().trace(
					'Value %j(%s) out of scalar range(%j) for %s',
					value,
					typeof value,
					scalar,
					dpt.id,
				)
			} else {
				// convert value from its scalar representation
				// e.g. in DPT5.001, 50(%) => 0x7F , 100(%) => 0xFF
				const a = (scalar[1] - scalar[0]) / (range[1] - range[0])
				const b = scalar[0] - range[0]
				tgtvalue = Math.round((value - b) / a)
			}
		} else {
			// just a plain numeric value, only check if within bounds
			// eslint-disable-next-line no-lonely-if
			if (value < range[0] || value > range[1]) {
				KnxLog.get().trace(
					'Value %j(%s) out of bounds(%j) for %s.%s',
					value,
					typeof value,
					range,
					dpt.id,
					dpt.subtypeid,
				)
			}
		}
		// generic APDU is assumed to convey an unsigned integer of arbitrary bitlength
		if (
			hasProp(dpt.basetype, 'signedness') &&
			dpt.basetype.signedness === 'signed'
		) {
			apdu.data.writeIntBE(tgtvalue, 0, nbytes)
		} else {
			apdu.data.writeUIntBE(tgtvalue, 0, nbytes)
		}
	}
	// knxLog.get().trace('generic populateAPDU tgtvalue=%j(%s) nbytes=%d => apdu=%j', tgtvalue, typeof tgtvalue, nbytes, apdu);
	return apdu
}

/* get the correct Javascript value from a APDU buffer for the given DPT
 * - either by a custom DPT formatAPDU function
 * - or by this generic version, which:
 * --  1) checks if the value adheres to the range set from the DPT's bitlength
 */
export function fromBuffer(buf: Buffer, dpt: DatapointConfig) {
	// sanity check
	if (!dpt) throw Error(util.format('DPT %s not found', dpt))
	let value = 0
	// get the raw APDU data for the given JS value
	if (typeof dpt.fromBuffer === 'function') {
		// nothing to do here, DPT-specific fromBuffer implementation will handle everything
		value = dpt.fromBuffer(buf)
	} else {
		// knxLog.get().trace('%s buflength == %d => %j', typeof buf, buf.length, JSON.stringify(buf) );
		// get a raw unsigned integer from the buffer
		if (buf.length > 6) {
			throw Error(
				'cannot handle unsigned integers more then 6 bytes in length',
			)
		}
		if (
			hasProp(dpt.basetype, 'signedness') &&
			dpt.basetype.signedness === 'signed'
		) {
			value = buf.readIntBE(0, buf.length)
		} else {
			value = buf.readUIntBE(0, buf.length)
		}
		// knxLog.get().trace(' ../knx/src/index.js : DPT : ' + JSON.stringify(dpt));   // for exploring dpt and implementing description
		if (hasProp(dpt, 'subtype') && hasProp(dpt.subtype, 'scalar_range')) {
			const range = hasProp(dpt.basetype, 'range')
				? dpt.basetype.range
				: [0, 2 ** dpt.basetype.bitlength - 1]
			const scalar = dpt.subtype.scalar_range
			// convert value from its scalar representation
			// e.g. in DPT5.001, 50(%) => 0x7F , 100(%) => 0xFF
			const a = (scalar[1] - scalar[0]) / (range[1] - range[0])
			const b = scalar[0] - range[0]
			value = Math.round(a * value + b)
			// knxLog.get().trace('fromBuffer scalar a=%j b=%j %j', a,b, value);
		}
	}
	//  knxLog.get().trace('generic fromBuffer buf=%j, value=%j', buf, value);
	return value
}

const cloneDpt = (d: DatapointConfig) => {
	const { fromBuffer: fb, formatAPDU: fa } = d
	return { ...JSON.parse(JSON.stringify(d)), fromBuffer: fb, formatAPDU: fa }
}
