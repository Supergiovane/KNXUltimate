/**
 * Unit tests for transport control TPDUs (T_Connect, T_Disconnect, T_ACK):
 * TPCI-only frames with cEMI length L = 0 and no APCI octet.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import NPDU from '../../src/protocol/cEMI/NPDU'
import LDataInd from '../../src/protocol/cEMI/LDataInd'
import KNXProtocol from '../../src/protocol/KNXProtocol'
import KNXTunnelingRequest from '../../src/protocol/KNXTunnelingRequest'

// addLen, Ctrl1, Ctrl2 (AT = 0), src 1.1.10, dst 1.1.20, L = 0, TPCI
const ldataInd = (src: number, dst: number, tpci: number) =>
	Buffer.from([
		0x00,
		0xb0,
		0x60,
		src >> 8,
		src & 0xff,
		dst >> 8,
		dst & 0xff,
		0x00,
		tpci,
	])

describe('NPDU transport control TPDU', () => {
	const cases: [string, number][] = [
		['T_Connect', 0x80],
		['T_Disconnect', 0x81],
		['T_ACK seq 0', 0xc2],
		['T_ACK seq 5', 0xc2 | (5 << 2)],
		['T_NAK seq 3', 0xc3 | (3 << 2)],
	]

	for (const [name, tpci] of cases) {
		it(`parses ${name} without reading an APCI octet`, () => {
			const frame = ldataInd(0x110a, 0x1114, tpci)
			const msg = LDataInd.createFromBuffer(frame)
			assert.ok(msg.npdu)
			assert.equal(msg.npdu.isTransportControl, true)
			assert.equal(msg.npdu.tpci, tpci)
			assert.equal(msg.npdu.isGroupRead, false)
			assert.equal(msg.npdu.isGroupWrite, false)
			assert.equal(msg.npdu.isGroupResponse, false)
			assert.equal(msg.srcAddress.toString(), '1.1.10')
			assert.equal(msg.dstAddress.toString(), '1.1.20')
			// Round trip: msgCode 29h + the original bytes
			assert.deepEqual(
				msg.toBuffer(),
				Buffer.concat([Buffer.from([0x29]), frame]),
			)
			assert.equal(msg.length, frame.length + 1)
		})
	}

	it('serializes a TPCI-only NPDU as length 0 + TPCI', () => {
		const npdu = NPDU.createTransportControl(0x80)
		assert.deepEqual(npdu.toBuffer(), Buffer.from([0x00, 0x80]))
		assert.equal(npdu.length, 2)
		assert.equal(npdu.action, -1)
	})

	it('parses the TUNNELING_REQUEST carrying a T_Connect', () => {
		// 06 10 0420 0014 | 04 chan seq 00 | 29 00 b0 60 11 0a 11 14 00 80
		const frame = Buffer.from(
			'061004200014041507002900b060110a11140080',
			'hex',
		)
		const { knxMessage } = KNXProtocol.parseMessage(frame)
		const req = knxMessage as KNXTunnelingRequest
		assert.equal(req.channelID, 0x15)
		assert.equal(req.seqCounter, 0x07)
		assert.equal(req.cEMIMessage.npdu.isTransportControl, true)
		assert.equal(req.cEMIMessage.npdu.tpci, 0x80)
		assert.deepEqual(req.toBuffer(), frame)
	})

	it('still parses a GroupValue_Write normally', () => {
		// Ctrl2 AT = 1, dst 1/2/3, L = 1, TPCI 00, APCI 81 (write, value 1)
		const frame = Buffer.from([
			0x00, 0xbc, 0xe0, 0x11, 0x0a, 0x0a, 0x03, 0x01, 0x00, 0x81,
		])
		const msg = LDataInd.createFromBuffer(frame)
		assert.equal(msg.npdu.isTransportControl, false)
		assert.equal(msg.npdu.isGroupWrite, true)
		assert.deepEqual(msg.npdu.dataValue, Buffer.from([0x01]))
		assert.deepEqual(
			msg.toBuffer(),
			Buffer.concat([Buffer.from([0x29]), frame]),
		)
	})
})
