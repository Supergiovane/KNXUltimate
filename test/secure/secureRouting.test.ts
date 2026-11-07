/**
 * Tests the KNX IP Secure routing receive path with real SecureWrapper frames.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { afterEach, beforeEach, describe, it } from 'node:test'
import assert from 'assert'
import { Socket as UDPSocket } from 'node:dgram'
import sinon from 'sinon'
import KNXClient, {
	ConncetionState,
	KNXClientEvents,
} from '../../src/KNXClient'
import KNXRoutingBusy from '../../src/protocol/KNXRoutingBusy'
import { KNX_CONSTANTS } from '../../src/protocol/KNXConstants'

const BACKBONE_KEY = '000102030405060708090a0b0c0d0e0f'
const OTHER_KEY = 'f0e0d0c0b0a090807060504030201000'
const RINFO = { address: '192.0.2.9', port: 3671, family: 'IPv4', size: 0 }

// GroupValue_Read of 1/4/1 from 1.1.1
const GROUP_READ = Buffer.from('0610053000112900bce011010c01010000', 'hex')

describe('KNX Secure routing receive path', () => {
	let clock: sinon.SinonFakeTimers
	let clients: KNXClient[]

	beforeEach(() => {
		clock = sinon.useFakeTimers({
			toFake: ['Date', 'setTimeout', 'clearTimeout', 'performance'],
		})
		sinon.stub(Math, 'random').returns(1)
		clients = []
	})

	afterEach(() => {
		for (const client of clients) {
			client['exitProcessingKNXQueueLoop'] = true
			client['clearAllTimers']()
		}
		clock.restore()
		sinon.restore()
	})

	function router(key: string, serial: string) {
		const sent: { time: number; buffer: Buffer }[] = []
		const errors: Error[] = []
		const indications: unknown[] = []
		const socket = sinon.createStubInstance(UDPSocket)
		socket.send.callsFake((buffer: Buffer, ...args: any[]) => {
			sent.push({ time: clock.now, buffer: Buffer.from(buffer) })
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
				localIPAddress: '192.0.2.2',
				loglevel: 'disable',
			},
			(instance) => {
				instance['_clientSocket'] = socket
			},
		)
		clients.push(client)
		client['_options'].isSecureKNXEnabled = true
		client['_secureBackboneKey'] = Buffer.from(key, 'hex')
		client['_secureSerial'] = Buffer.from(serial, 'hex')
		client['_secureRoutingTimerAuthenticated'] = true
		client['_connectionState'] = ConncetionState.CONNECTED
		client['socketReady'] = true
		client.clearToSend = true
		client.on(KNXClientEvents.error, (error) => errors.push(error))
		client.on(KNXClientEvents.indication, (packet) =>
			indications.push(packet),
		)
		const receive = (frame: Buffer) =>
			client['secureOnUdpData'](frame, RINFO as any)
		return { client, sent, errors, indications, receive }
	}

	function setup() {
		const local = router(BACKBONE_KEY, '010203040506')
		const peer = router(BACKBONE_KEY, '0a0b0c0d0e0f')
		const stranger = router(OTHER_KEY, '111111111111')
		const wrap = (frame: Buffer, from = peer) =>
			from.client['secureWrapRouting'](frame) as Buffer
		const pause = () => local.client['routingFlowControl'].remainingPauseMs
		return { local, peer, stranger, wrap, pause }
	}

	function assertDiscarded(h: ReturnType<typeof setup>) {
		assert.equal(h.pause(), 0)
		assert.deepEqual(h.local.errors, [])
		assert.deepEqual(h.local.indications, [])
		assert.equal(h.local.client.isConnected(), true)
	}

	it('pauses on an authentic ROUTING_BUSY and resumes with a secured frame', async () => {
		const h = setup()
		h.local.receive(h.wrap(new KNXRoutingBusy(100).toBuffer()))
		assert.deepEqual(
			h.local.errors.map((e) => e.message),
			['ROUTING_BUSY'],
		)

		const outcome = h.local.client.write('1/4/1', true, '1.001')
		await clock.tickAsync(149)
		assert.deepEqual(h.local.sent, [])
		await clock.tickAsync(1)
		await outcome
		assert.equal(h.local.sent.length, 1)
		const [{ time, buffer }] = h.local.sent
		assert.equal(time, 150)
		assert.equal(buffer.readUInt16BE(2), KNX_CONSTANTS.SECURE_WRAPPER)
		const inner: Buffer = h.peer.client['secureDecryptRouting'](buffer)
		assert.equal(inner.readUInt16BE(2), KNX_CONSTANTS.ROUTING_INDICATION)
	})

	describe('timer synchronization', () => {
		function starting() {
			const h = router(BACKBONE_KEY, '010203040506')
			const notify = sinon.stub(h.client as any, 'secureSendTimerNotify')
			h.client['_secureRoutingTimerAuthenticated'] = false
			h.client['_connectionState'] = ConncetionState.DISCONNECTED
			h.client['_secureRoutingLatencyMs'] = 2000
			return { ...h, notify }
		}

		it('waits for Connect(), however late it comes', async () => {
			const h = starting()
			h.client['secureRoutingStartTimerSync']()
			await clock.tickAsync(10000)
			assert.equal(h.notify.callCount, 0)
			assert.equal(h.client['_secureRoutingTimerAuthenticated'], false)

			h.client['_connectionState'] = ConncetionState.CONNECTING
			h.client['secureRoutingStartTimerSync']()
			await clock.tickAsync(120)
			assert.equal(h.notify.callCount, 1)
		})

		it('waits for the backbone key', async () => {
			const h = starting()
			h.client['_connectionState'] = ConncetionState.CONNECTING
			h.client['_secureBackboneKey'] = undefined
			h.client['secureRoutingStartTimerSync']()
			await clock.tickAsync(10000)
			assert.equal(h.notify.callCount, 0)
		})

		it('falls back to the local timer after the latency tolerance', async () => {
			const h = starting()
			const connected = sinon.spy()
			h.client.on(KNXClientEvents.connected, connected)
			h.client['_connectionState'] = ConncetionState.CONNECTING
			h.client['secureRoutingStartTimerSync']()
			await clock.tickAsync(2119)
			assert.equal(connected.callCount, 0)
			await clock.tickAsync(1)
			assert.equal(connected.callCount, 1)
			assert.equal(h.client['_secureRoutingTimerAuthenticated'], true)
		})

		it('connects again when the timer is already authenticated', async () => {
			const h = starting()
			const connected = sinon.spy()
			h.client.on(KNXClientEvents.connected, connected)
			h.client['_secureRoutingTimerAuthenticated'] = true
			h.client['_connectionState'] = ConncetionState.CONNECTING
			h.client['secureRoutingStartTimerSync']()
			await clock.tickAsync(2120)
			assert.equal(connected.callCount, 1)
		})
	})

	it('delivers an authentic ROUTING_INDICATION', () => {
		const h = setup()
		h.local.receive(h.wrap(GROUP_READ))
		assert.equal(h.local.indications.length, 1)
		assert.deepEqual(h.local.errors, [])
	})

	it('discards a tampered wrapper without raising an error', () => {
		const h = setup()
		const frame = h.wrap(new KNXRoutingBusy(60000).toBuffer())
		frame[frame.length - 20] ^= 0xff
		h.local.receive(frame)
		assertDiscarded(h)
	})

	it('discards a wrapper made with another backbone key', () => {
		const h = setup()
		h.local.receive(h.wrap(GROUP_READ, h.stranger))
		assertDiscarded(h)
	})

	it('discards a wrapper that is too short', () => {
		const h = setup()
		h.local.receive(h.wrap(GROUP_READ).subarray(0, 40))
		assertDiscarded(h)
	})

	it('discards a wrapper with a session id other than 0', () => {
		const h = setup()
		const frame = h.wrap(GROUP_READ)
		frame[7] = 1
		h.local.receive(frame)
		assertDiscarded(h)
	})

	it('logs only the first discarded wrapper of a connection as an error', async () => {
		const h = setup()
		const logged = sinon.stub(h.local.client['sysLogger'], 'error')
		const drops = () =>
			logged.getCalls().filter((c) => /Dropping/.test(c.args[0])).length

		h.local.receive(h.wrap(GROUP_READ, h.stranger))
		h.local.receive(h.wrap(GROUP_READ, h.stranger))
		h.local.receive(h.wrap(GROUP_READ, h.stranger))
		assert.equal(drops(), 1)
		assert.match(logged.firstCall.args[0], /check the backbone key/)

		await h.local.client['setDisconnected']('test')
		h.local.receive(h.wrap(GROUP_READ, h.stranger))
		assert.equal(drops(), 2)
	})

	it('keeps receiving after a discarded wrapper', () => {
		const h = setup()
		h.local.receive(h.wrap(GROUP_READ, h.stranger))
		h.local.receive(h.wrap(GROUP_READ))
		assert.equal(h.local.indications.length, 1)
		assert.deepEqual(h.local.errors, [])
	})
})
