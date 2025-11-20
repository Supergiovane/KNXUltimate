/**
 * Unit tests for Serial FT1.2 (KBerry) integration.
 *
 * Focus:
 *  - SerialFT12.initialize() honours the isKBERRY flag
 *  - KNXClient in SerialFT12 mode sends L_DATA.req (0x11) over cEMI
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'
import SerialFT12 from '../../src/transports/SerialFT12'
import KNXClient, { ConncetionState } from '../../src/KNXClient'
import CEMIConstants from '../../src/protocol/cEMI/CEMIConstants'

describe('SerialFT12 KBerry initialisation', () => {
	it('runs full KBerry init sequence by default (isKBERRY omitted)', async () => {
		const driver: any = new SerialFT12({})

		let resetCalls = 0
		let indicationCalls = 0
		let commModeCalls = 0
		let disableFilterCalls = 0

		driver.sendReset = async () => {
			resetCalls += 1
		}
		driver.setIndicationSending = async () => {
			indicationCalls += 1
		}
		driver.sendCommMode = async () => {
			commModeCalls += 1
		}
		driver.disableGroupFilter = async () => {
			disableFilterCalls += 1
		}

		await driver.initialize()

		assert.strictEqual(resetCalls, 1, 'sendReset should be called once')
		assert.strictEqual(
			indicationCalls,
			1,
			'setIndicationSending should be called once by default',
		)
		assert.strictEqual(
			commModeCalls,
			1,
			'sendCommMode should be called once',
		)
		assert.strictEqual(
			disableFilterCalls,
			1,
			'disableGroupFilter should be called once by default',
		)
	})

	it('skips KBerry-specific steps when isKBERRY is false', async () => {
		const driver: any = new SerialFT12({ isKBERRY: false })

		let resetCalls = 0
		let indicationCalls = 0
		let commModeCalls = 0
		let disableFilterCalls = 0

		driver.sendReset = async () => {
			resetCalls += 1
		}
		driver.setIndicationSending = async () => {
			indicationCalls += 1
		}
		driver.sendCommMode = async () => {
			commModeCalls += 1
		}
		driver.disableGroupFilter = async () => {
			disableFilterCalls += 1
		}

		await driver.initialize()

		assert.strictEqual(resetCalls, 1, 'sendReset should be called once')
		assert.strictEqual(
			indicationCalls,
			0,
			'setIndicationSending should not be called when isKBERRY=false',
		)
		assert.strictEqual(
			commModeCalls,
			1,
			'sendCommMode should still be called once',
		)
		assert.strictEqual(
			disableFilterCalls,
			0,
			'disableGroupFilter should not be called when isKBERRY=false',
		)
	})
})

describe('KNXClient serial FT1.2 (KBerry) behaviour', () => {
	it('uses L_DATA.req (0x11) on SerialFT12 writes', async () => {
		const sentPayloads: Buffer[] = []

		// Prevent real sockets from being created
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

		// Stub serial driver to capture cEMI payloads instead of touching hardware
		anyClient._serialDriver = {
			sendCemiPayload: async (payload: Buffer) => {
				sentPayloads.push(Buffer.from(payload))
			},
		}

		client.write('0/1/26', true, '1.001')

		// Allow the internal queue/async processing to run
		await new Promise((resolve) => setTimeout(resolve, 50))

		assert.strictEqual(
			sentPayloads.length,
			1,
			'Exactly one cEMI frame should be sent over serial',
		)

		const cemi = sentPayloads[0]
		assert.ok(cemi.length > 0, 'cEMI buffer should not be empty')
		assert.strictEqual(
			cemi.readUInt8(0),
			CEMIConstants.L_DATA_REQ,
			'Serial FT1.2 should send L_DATA.req (0x11), not L_DATA.ind',
		)
	})
})
