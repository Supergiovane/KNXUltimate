import { describe, it } from 'node:test'
import assert from 'node:assert'

import KNXClient, { ConncetionState } from '../../src/KNXClient'
import CEMIConstants from '../../src/protocol/cEMI/CEMIConstants'
import LDataReq from '../../src/protocol/cEMI/LDataReq'

describe('KNXClient respondRaw()', () => {
	it('sends GroupValue_Response over SerialFT12 as L_DATA.req with ACK=0', async () => {
		const sentPayloads: Buffer[] = []

		const client = new KNXClient(
			{
				hostProtocol: 'SerialFT12',
				serialInterface: {
					path: '/dev/null',
					isKBERRY: true,
				},
				physAddr: '1.1.200',
				loglevel: 'error',
			},
			() => {},
		)

		const anyClient: any = client
		anyClient._connectionState = ConncetionState.CONNECTED
		anyClient.socketReady = true
		anyClient.clearToSend = true

		anyClient._serialDriver = {
			sendCemiPayload: async (payload: Buffer) => {
				sentPayloads.push(Buffer.from(payload))
			},
		}

		// 1-bit payload, encoded into APCI low bits (bitlength <= 6).
		client.respondRaw('0/1/26', Buffer.from([0x01]), 1)

		await new Promise<void>((resolve) => {
			setTimeout(resolve, 50)
		})

		assert.strictEqual(sentPayloads.length, 1)

		const cemi = sentPayloads[0]
		assert.ok(cemi.length > 0)
		assert.strictEqual(cemi.readUInt8(0), CEMIConstants.L_DATA_REQ)

		const ldata = LDataReq.createFromBuffer(cemi, 1)
		assert.strictEqual(ldata.npdu.isGroupResponse, true)
		assert.strictEqual(ldata.npdu.isGroupWrite, false)
		assert.strictEqual(ldata.control.ack, 0)
		assert.strictEqual(ldata.npdu.dataValue.readUInt8(0), 0x01)
	})
})
