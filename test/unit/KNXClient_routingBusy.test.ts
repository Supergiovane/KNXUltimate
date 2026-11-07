/**
 * Tests how KNXClient reacts to ROUTING_BUSY frames.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { Socket as UDPSocket } from 'node:dgram'
import os from 'node:os'
import sinon from 'sinon'

import KNXClient, {
	ConncetionState,
	KNXClientEvents,
	KNXClientOptions,
	KNXTimer,
} from '../../src/KNXClient'
import KNXProtocol from '../../src/protocol/KNXProtocol'
import KNXRoutingBusy from '../../src/protocol/KNXRoutingBusy'
import KNXRoutingIndication from '../../src/protocol/KNXRoutingIndication'
import { KNX_CONSTANTS } from '../../src/protocol/KNXConstants'

const RINFO = { address: '192.0.2.1', port: 3671, family: 'IPv4', size: 0 }

// ISO 22510 Annex B.17: wait time 100 ms, with structure length 04h
const ANNEX_B17 = Buffer.from('06100532000c040000640000', 'hex')

// The same frame as XKNX writes it, with the real structure length
const XKNX_VECTOR = Buffer.from('06100532000c060000640000', 'hex')

// GroupValue_Read of 1/4/1 from 1.1.1
const GROUP_READ = Buffer.from('0610053000112900bce011010c01010000', 'hex')

function routingBusy(waitTime: number) {
	return new KNXRoutingBusy(waitTime).toBuffer()
}

describe('KNXRoutingBusy', () => {
	for (const [name, frame] of [
		['Annex B.17', ANNEX_B17],
		['XKNX', XKNX_VECTOR],
	] as const) {
		it(`parses the ${name} frame`, () => {
			const { knxHeader, knxMessage } = KNXProtocol.parseMessage(frame)
			assert.equal(knxHeader.service_type, KNX_CONSTANTS.ROUTING_BUSY)
			const busy = knxMessage as KNXRoutingBusy
			assert.equal(busy.deviceState, 0)
			assert.equal(busy.waitTime, 100)
			assert.equal(busy.controlField, 0)
		})
	}

	it('serialises with the real structure length', () => {
		assert.deepEqual(new KNXRoutingBusy(100).toBuffer(), XKNX_VECTOR)
	})

	it('keeps the device state and the control field', () => {
		const buffer = new KNXRoutingBusy(500, 1, 0x1234).toBuffer()
		assert.equal(buffer.toString('hex'), '06100532000c060101f41234')
		const busy = KNXProtocol.parseMessage(buffer)
			.knxMessage as KNXRoutingBusy
		assert.equal(busy.deviceState, 1)
		assert.equal(busy.waitTime, 500)
		assert.equal(busy.controlField, 0x1234)
	})

	it('rejects a wrong length', () => {
		assert.throws(
			() =>
				KNXRoutingBusy.createFromBuffer(Buffer.from('06000064', 'hex')),
			/wrong length/,
		)
	})
})

describe('KNXClient ROUTING_BUSY flow control', () => {
	let clock: sinon.SinonFakeTimers
	let clients: KNXClient[]

	beforeEach(() => {
		clock = sinon.useFakeTimers({
			toFake: ['Date', 'setTimeout', 'clearTimeout', 'performance'],
		})
		clients = []
		sinon.stub(Math, 'random').returns(1)
		sinon.stub(os, 'networkInterfaces').returns({
			eth0: [
				{
					address: '192.0.2.2',
					netmask: '255.255.255.0',
					family: 'IPv4',
					mac: '00:00:00:00:00:00',
					internal: false,
					cidr: '192.0.2.2/24',
				},
			],
		})
	})

	afterEach(() => {
		for (const client of clients) {
			client['exitProcessingKNXQueueLoop'] = true
			client['clearAllTimers']()
		}
		clock.restore()
		sinon.restore()
	})

	function setup(options: Partial<KNXClientOptions> = {}) {
		const sent: { time: number; type: number; buffer: Buffer }[] = []
		const errors: Error[] = []
		const socket = sinon.createStubInstance(UDPSocket)
		socket.send.callsFake((buffer: Buffer, ...args: any[]) => {
			sent.push({
				time: clock.now,
				type: buffer.readUInt16BE(2),
				buffer: Buffer.from(buffer),
			})
			const callback = args[args.length - 1]
			if (typeof callback === 'function') callback(null)
		})
		socket.close.callsFake((callback?: () => void) => {
			callback?.()
			return socket
		})
		const client = new KNXClient(
			{
				hostProtocol: 'Multicast',
				ipAddr: '224.0.23.12',
				physAddr: '1.0.39',
				loglevel: 'disable',
				KNXQueueSendIntervalMilliseconds: 25,
				...options,
			},
			(instance) => {
				instance['_clientSocket'] = socket
			},
		)
		clients.push(client)
		client['_connectionState'] = ConncetionState.CONNECTED
		client['socketReady'] = true
		client.clearToSend = true
		client.on(KNXClientEvents.error, (error) => errors.push(error))
		const receive = (buffer: Buffer) =>
			client['processInboundMessage'](buffer, RINFO)
		const indications = () =>
			sent.filter((p) => p.type === KNX_CONSTANTS.ROUTING_INDICATION)
		return { client, sent, errors, receive, indications }
	}

	it('holds back the answer to a read for the wait time (issue #118)', async () => {
		const h = setup()
		h.client.on(KNXClientEvents.indication, () => {
			h.client.respond('1/4/1', Buffer.from([1]) as any, '1.001')
		})

		h.receive(routingBusy(500))
		await clock.tickAsync(5)
		h.receive(GROUP_READ)
		await clock.tickAsync(544)
		assert.deepEqual(h.indications(), [])

		// tw 500 ms + trandom 50 ms, measured from the ROUTING_BUSY
		await clock.tickAsync(1)
		assert.deepEqual(
			h.indications().map((p) => p.time),
			[550],
		)
	})

	it('still reports ROUTING_BUSY as the error event Node-RED filters on', () => {
		const h = setup()
		h.receive(routingBusy(100))
		assert.deepEqual(
			h.errors.map((e) => e.message),
			['ROUTING_BUSY'],
		)
		assert.equal(h.client.isConnected(), true)
	})

	it('sends at once without a ROUTING_BUSY', async () => {
		const h = setup()
		h.client.write('1/4/1', true, '1.001')
		await clock.tickAsync(0)
		assert.deepEqual(
			h.indications().map((p) => p.time),
			[0],
		)
	})

	it('resumes in order, at the usual pace', async () => {
		const h = setup()
		h.receive(routingBusy(100))
		h.client.write('1/4/1', true, '1.001')
		h.client.write('1/4/2', true, '1.001')
		h.client.write('1/4/3', true, '1.001')
		await clock.tickAsync(1000)
		assert.deepEqual(
			h.indications().map((p) => p.time),
			[150, 175, 200],
		)
		assert.deepEqual(
			h
				.indications()
				.map((p) =>
					(
						KNXProtocol.parseMessage(p.buffer)
							.knxMessage as KNXRoutingIndication
					).cEMIMessage.dstAddress.toString(),
				),
			['1/4/1', '1/4/2', '1/4/3'],
		)
	})

	it('stops a queue that is already being sent', async () => {
		const h = setup()
		h.client.write('1/4/1', true, '1.001')
		h.client.write('1/4/2', true, '1.001')
		h.client.write('1/4/3', true, '1.001')
		await clock.tickAsync(10)
		h.receive(routingBusy(100))
		await clock.tickAsync(1000)
		assert.deepEqual(
			h.indications().map((p) => p.time),
			[0, 160, 185],
		)
	})

	it('extends a running pause with a later ROUTING_BUSY', async () => {
		const h = setup()
		h.receive(routingBusy(100))
		h.client.write('1/4/1', true, '1.001')
		await clock.tickAsync(90)
		h.receive(routingBusy(100))
		await clock.tickAsync(1000)
		// Second frame at 90 ms, N is 2: 100 ms + 100 ms
		assert.deepEqual(
			h.indications().map((p) => p.time),
			[290],
		)
	})

	it('drops the pause on disconnection', async () => {
		const h = setup()
		h.receive(routingBusy(1000))
		h.client.write('1/4/1', true, '1.001')
		await clock.tickAsync(1)
		assert.equal(h.client['timers'].has(KNXTimer.ROUTING_BUSY), true)

		await h.client['setDisconnected']('test')
		assert.equal(h.client['timers'].has(KNXTimer.ROUTING_BUSY), false)
		assert.equal(h.client['routingFlowControl'].remainingPauseMs, 0)
		assert.deepEqual(h.indications(), [])
	})

	it('ignores a malformed ROUTING_BUSY without raising an error', async () => {
		const h = setup()
		h.receive(Buffer.from('06100532000a04000064', 'hex'))
		assert.equal(h.client['routingFlowControl'].remainingPauseMs, 0)
		assert.deepEqual(h.errors, [])
	})

	it('does not pause a tunnel', () => {
		const h = setup({ hostProtocol: 'TunnelUDP', ipAddr: '192.0.2.1' })
		h.receive(routingBusy(100))
		assert.equal(h.client['routingFlowControl'].remainingPauseMs, 0)
	})

	it('discards a plain ROUTING_BUSY on secure routing', () => {
		const h = setup()
		h.client['_options'].isSecureKNXEnabled = true
		h.client['secureOnUdpData'](routingBusy(60000), RINFO as any)
		assert.equal(h.client['routingFlowControl'].remainingPauseMs, 0)
		assert.deepEqual(h.errors, [])
	})
})
