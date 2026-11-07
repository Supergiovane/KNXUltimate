/**
 * Tests the Promise that KNXClient send methods return for a telegram outcome.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { Socket as UDPSocket } from 'node:dgram'
import { Socket as TCPSocket } from 'node:net'
import os from 'node:os'
import sinon from 'sinon'

import KNXClient, {
	ConncetionState,
	KNXClientEvents,
	KNXClientOptions,
} from '../../src/KNXClient'
import KNXProtocol from '../../src/protocol/KNXProtocol'
import KNXPacket from '../../src/protocol/KNXPacket'
import NPDU from '../../src/protocol/cEMI/NPDU'
import KNXRoutingBusy from '../../src/protocol/KNXRoutingBusy'
import KNXTunnelingRequest from '../../src/protocol/KNXTunnelingRequest'
import { KNX_CONSTANTS } from '../../src/protocol/KNXConstants'
import { ConfirmationError, RequestTimeoutError } from '../../src/errors'

const CHANNEL = 81

describe('KNXClient telegram outcome', () => {
	let clock: sinon.SinonFakeTimers
	let clients: KNXClient[]

	beforeEach(() => {
		clock = sinon.useFakeTimers({
			toFake: ['Date', 'setTimeout', 'clearTimeout', 'performance'],
		})
		clients = []
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
			client['failConfirmations'](new Error('test over'))
			client['exitProcessingKNXQueueLoop'] = true
			client['clearAllTimers']()
		}
		clock.restore()
		sinon.restore()
	})

	/** Follow a Promise without leaving a rejection unhandled */
	function track(promise: Promise<void>) {
		const outcome: { state: string; error?: Error } = { state: 'pending' }
		promise.then(
			() => {
				outcome.state = 'resolved'
			},
			(error) => {
				outcome.state = 'rejected'
				outcome.error = error
			},
		)
		return outcome
	}

	function setup(options: Partial<KNXClientOptions> = {}) {
		const sent: { time: number; type: number; seq: number }[] = []
		const errors: Error[] = []
		const onSent = (buffer: Buffer) => {
			const type = buffer.readUInt16BE(2)
			sent.push({
				time: clock.now,
				type,
				seq:
					type === KNX_CONSTANTS.TUNNELING_REQUEST
						? (
								KNXProtocol.parseMessage(buffer)
									.knxMessage as KNXTunnelingRequest
							).seqCounter
						: -1,
			})
		}
		const udp = sinon.createStubInstance(UDPSocket)
		udp.send.callsFake((buffer: Buffer, ...args: any[]) => {
			onSent(buffer)
			const callback = args[args.length - 1]
			if (typeof callback === 'function') callback(null)
		})
		udp.close.callsFake((callback?: () => void) => {
			callback?.()
			return udp
		})
		const tcp = sinon.createStubInstance(TCPSocket)
		tcp.write.callsFake((buffer: any, ...args: any[]) => {
			onSent(buffer)
			const callback = args[args.length - 1]
			if (typeof callback === 'function') callback(null)
			return true
		})
		const client = new KNXClient(
			{
				hostProtocol: 'TunnelUDP',
				ipAddr: '192.0.2.1',
				physAddr: '1.0.39',
				loglevel: 'disable',
				KNXQueueSendIntervalMilliseconds: 25,
				...options,
			},
			(instance) => {
				instance['_clientSocket'] =
					options.hostProtocol === 'TunnelTCP' ? tcp : udp
			},
		)
		clients.push(client)
		client['_connectionState'] = ConncetionState.CONNECTED
		client['_channelID'] = CHANNEL
		client['_clientTunnelSeqNumber'] = 193
		client['socketReady'] = true
		client.clearToSend = true
		client.on(KNXClientEvents.error, (error) => errors.push(error))

		let rxSeq = 0
		const receive = (packet: KNXPacket | Buffer) =>
			client['processInboundMessage'](
				Buffer.isBuffer(packet) ? packet : packet.toBuffer(),
				{ address: '192.0.2.1', port: 3671, family: 'IPv4', size: 0 },
			)
		const ack = (seq: number) =>
			receive(KNXProtocol.newKNXTunnelingACK(CHANNEL, seq, 0))
		/**
		 * L_Data.con from the tunnel. `npdu` defaults to GroupValue_Write true.
		 * Control field 1: BCh positive, BDh negative (error bit set)
		 */
		const lDataCon = (
			dst = '0001',
			{ npdu = '010081', control = 'bc' } = {},
		) => {
			const seq = (rxSeq++).toString(16).padStart(2, '0')
			const cemi = `2e00${control}e0100b${dst}${npdu}`
			const length = (10 + cemi.length / 2).toString(16).padStart(4, '0')
			receive(
				Buffer.from(
					`06100420${length}04${CHANNEL.toString(16)}${seq}00${cemi}`,
					'hex',
				),
			)
		}
		const requests = () =>
			sent.filter((p) => p.type === KNX_CONSTANTS.TUNNELING_REQUEST)
		return { client, sent, errors, receive, ack, lDataCon, requests }
	}

	it('resolves on the positive L_Data.con, not on the ACK', async () => {
		const h = setup()
		const outcome = track(h.client.write('0/0/1', true, '1.001'))
		await clock.tickAsync(10)
		assert.equal(h.requests().length, 1)

		h.ack(194)
		await clock.tickAsync(10)
		assert.equal(outcome.state, 'pending')

		h.lDataCon()
		await clock.tickAsync(0)
		assert.equal(outcome.state, 'resolved')
		assert.equal(h.client['pendingConfirmations'].length, 0)
	})

	it('resolves when the L_Data.con overtakes the ACK', async () => {
		const h = setup()
		const outcome = track(h.client.write('0/0/1', true, '1.001'))
		await clock.tickAsync(0)
		h.lDataCon()
		h.ack(194)
		await clock.tickAsync(0)
		assert.equal(outcome.state, 'resolved')
	})

	it('rejects on a negative L_Data.con and keeps the tunnel up', async () => {
		const h = setup()
		const outcome = track(h.client.write('0/0/1', true, '1.001'))
		await clock.tickAsync(0)
		h.ack(194)
		h.lDataCon('0001', { control: 'bd' })
		await clock.tickAsync(0)
		assert.equal(outcome.state, 'rejected')
		assert.ok(outcome.error instanceof ConfirmationError)
		assert.equal(outcome.error.name, 'ConfirmationError')
		assert.equal(h.client.isConnected(), true)
		assert.deepEqual(h.errors, [])
	})

	it('rejects when the gateway never acknowledges (issue #119)', async () => {
		const h = setup()
		const outcome = track(h.client.write('1/0/1', true, '1.001'))
		await clock.tickAsync(1999)
		assert.equal(outcome.state, 'pending')
		assert.deepEqual(
			h.requests().map((p) => [p.time, p.seq]),
			[
				[0, 194],
				[1000, 194],
			],
		)

		await clock.tickAsync(1)
		assert.equal(outcome.state, 'rejected')
		assert.ok(outcome.error instanceof RequestTimeoutError)
	})

	it('rejects when the ACK arrives but the L_Data.con does not', async () => {
		const h = setup()
		const outcome = track(h.client.write('0/0/1', true, '1.001'))
		await clock.tickAsync(0)
		h.ack(194)
		await clock.tickAsync(2999)
		assert.equal(outcome.state, 'pending')
		await clock.tickAsync(1)
		assert.equal(outcome.state, 'rejected')
		assert.ok(outcome.error instanceof RequestTimeoutError)
		assert.equal(h.client.isConnected(), true)
	})

	const onlyTheLDataConCounts =
		(options: Partial<KNXClientOptions>) => async () => {
			const h = setup(options)
			const confirmed = track(h.client.write('0/0/1', true, '1.001'))
			await clock.tickAsync(25)
			h.lDataCon()
			await clock.tickAsync(0)
			assert.equal(confirmed.state, 'resolved')

			const missing = track(h.client.write('0/0/2', true, '1.001'))
			await clock.tickAsync(3000)
			assert.equal(missing.state, 'rejected')
			assert.ok(missing.error instanceof RequestTimeoutError)
			assert.equal(h.client.isConnected(), true)
			assert.equal(h.requests().length, 2)
		}

	it(
		'only counts the L_Data.con with waitForTunnelingAck: false',
		onlyTheLDataConCounts({ waitForTunnelingAck: false }),
	)

	it(
		'only counts the L_Data.con with suppress_ack_ldatareq: true',
		onlyTheLDataConCounts({ suppress_ack_ldatareq: true }),
	)

	it('rejects telegrams still in the queue when the tunnel fails', async () => {
		const h = setup()
		const first = track(h.client.write('0/0/1', true, '1.001'))
		const second = track(h.client.write('0/0/2', true, '1.001'))
		await clock.tickAsync(2000)
		assert.equal(first.state, 'rejected')
		assert.equal(second.state, 'rejected')
		assert.equal(
			h.requests().every((p) => p.seq === 194),
			true,
		)
	})

	it('rejects pending telegrams on disconnection', async () => {
		const h = setup()
		const outcome = track(h.client.write('0/0/1', true, '1.001'))
		await clock.tickAsync(0)
		await h.client['setDisconnected']('gone')
		await clock.tickAsync(0)
		assert.equal(outcome.state, 'rejected')
		assert.match(outcome.error.message, /Disconnected: gone/)
	})

	it('rejects a telegram the socket refuses, and the ones behind it', async () => {
		const h = setup()
		h.client['processKnxPacketQueueItem'] = async () => false
		const first = track(h.client.write('0/0/1', true, '1.001'))
		const second = track(h.client.write('0/0/2', true, '1.001'))
		await clock.tickAsync(0)
		assert.equal(first.state, 'rejected')
		assert.equal(second.state, 'rejected')
		assert.equal(h.client['pendingConfirmations'].length, 0)
	})

	it('keeps throwing when not connected', async () => {
		const h = setup()
		h.client['_connectionState'] = ConncetionState.DISCONNECTED
		assert.throws(
			() => h.client.write('0/0/1', true, '1.001'),
			/not connected/,
		)
		assert.throws(() => h.client.read('0/0/1'), /not connected/)
		assert.equal(h.client['nextConfirmation'], undefined)
		assert.equal(h.client['pendingConfirmations'].length, 0)
	})

	it('keeps throwing on an invalid value in strict mode', () => {
		const h = setup({ strictDatapoints: true })
		assert.throws(() => h.client.write('0/0/1', 'not a bool', '5.001'))
		assert.equal(h.client['pendingConfirmations'].length, 0)
	})

	it('never turns an ignored failure into an unhandled rejection', async () => {
		const unhandled: unknown[] = []
		const onUnhandled = (reason: unknown) => unhandled.push(reason)
		process.on('unhandledRejection', onUnhandled)
		try {
			const h = setup()
			h.client.write('0/0/1', true, '1.001')
			await clock.tickAsync(0)
			h.ack(194)
			await clock.tickAsync(3000)
			// Unhandled rejections are reported once the microtasks are drained
			await new Promise((resolve) => {
				setImmediate(resolve)
			})
			assert.equal(h.client['pendingConfirmations'].length, 0)
			assert.deepEqual(unhandled, [])
			assert.deepEqual(h.errors, [])
			assert.equal(h.client.isConnected(), true)
		} finally {
			process.off('unhandledRejection', onUnhandled)
		}
	})

	it('rejects when a raw method refuses its data', async () => {
		const h = setup()
		const write = track(h.client.writeRaw('0/0/1', 'x' as any, 8))
		const respond = track(h.client.respondRaw('0/0/1', 'x' as any, 8))
		await clock.tickAsync(0)
		assert.equal(write.state, 'rejected')
		assert.equal(respond.state, 'rejected')
	})

	it('matches each L_Data.con to its own telegram', async () => {
		const h = setup()
		const first = track(h.client.write('0/0/1', true, '1.001'))
		await clock.tickAsync(0)
		h.ack(194)
		const second = track(h.client.write('0/0/2', false, '1.001'))
		await clock.tickAsync(50)
		h.ack(195)
		assert.equal(h.requests().length, 2)

		// Other group address, then same address with another value
		h.lDataCon('0003')
		h.lDataCon('0001', { npdu: '010080' })
		await clock.tickAsync(0)
		assert.deepEqual([first.state, second.state], ['pending', 'pending'])

		h.lDataCon('0002', { npdu: '010080' })
		await clock.tickAsync(0)
		assert.deepEqual([first.state, second.state], ['pending', 'resolved'])

		h.lDataCon('0001')
		await clock.tickAsync(0)
		assert.equal(first.state, 'resolved')
	})

	it('settles identical telegrams in the order they were sent', async () => {
		const h = setup()
		const first = track(h.client.write('0/0/1', true, '1.001'))
		await clock.tickAsync(0)
		h.ack(194)
		const second = track(h.client.write('0/0/1', true, '1.001'))
		await clock.tickAsync(50)
		h.ack(195)
		h.lDataCon()
		await clock.tickAsync(0)
		assert.deepEqual([first.state, second.state], ['resolved', 'pending'])
		h.lDataCon('0001', { control: 'bd' })
		await clock.tickAsync(0)
		assert.equal(second.state, 'rejected')
	})

	it('starts the L_Data.con timeout when the telegram leaves the queue', async () => {
		const h = setup()
		const first = track(h.client.write('0/0/1', true, '1.001'))
		const second = track(h.client.write('0/0/1', true, '1.001'))
		await clock.tickAsync(0)
		// The second telegram is held back by the missing ACK of the first,
		// so this confirmation can only belong to the first one
		assert.equal(h.requests().length, 1)
		h.lDataCon()
		await clock.tickAsync(0)
		assert.deepEqual([first.state, second.state], ['resolved', 'pending'])

		await clock.tickAsync(500)
		h.ack(194)
		await clock.tickAsync(25)
		assert.equal(h.requests().length, 2)
		const sentAt = h.requests()[1].time
		h.ack(195)

		await clock.tickAsync(sentAt + 2999 - clock.now)
		assert.equal(second.state, 'pending')
		await clock.tickAsync(1)
		assert.equal(second.state, 'rejected')
	})

	it('covers read and respond', async () => {
		const h = setup()
		const read = track(h.client.read('0/0/1'))
		await clock.tickAsync(0)
		h.ack(194)
		h.lDataCon('0001', { npdu: '010000' })
		await clock.tickAsync(25)
		const respond = track(h.client.respond('0/0/1', true as any, '1.001'))
		await clock.tickAsync(0)
		h.ack(195)
		h.lDataCon('0001', { npdu: '010041' })
		await clock.tickAsync(0)
		assert.deepEqual([read.state, respond.state], ['resolved', 'resolved'])
	})

	it('resolves on the L_Data.con over TCP, where no ACK exists', async () => {
		const h = setup({ hostProtocol: 'TunnelTCP' })
		const outcome = track(h.client.write('0/0/1', true, '1.001'))
		await clock.tickAsync(0)
		assert.equal(h.requests().length, 1)
		h.lDataCon()
		await clock.tickAsync(0)
		assert.equal(outcome.state, 'resolved')
	})

	it('matches the L_Data.con of a Data Secure telegram as transmitted', async () => {
		const h = setup({ hostProtocol: 'TunnelTCP' })
		const secured = NPDU.createFromBuffer(Buffer.from('0203e0aa', 'hex'))
		let plain: NPDU
		h.client['_options'].isSecureKNXEnabled = true
		h.client['secureWrap'] = (frame: Buffer) => frame
		h.client['maybeApplyDataSecure'] = (cemi: any) => {
			plain = cemi.npdu
			cemi.npdu = secured
		}
		// write() puts the plain APDU back right after the first transmission
		h.client['ensurePlainCEMI'] = (cemi: any) => {
			cemi.npdu = plain
			return true
		}

		const outcome = track(h.client.write('0/0/1', true, '1.001'))
		await clock.tickAsync(0)
		h.lDataCon('0001', { npdu: '010081' })
		await clock.tickAsync(0)
		assert.equal(outcome.state, 'pending')
		h.lDataCon('0001', { npdu: '0203e0aa' })
		await clock.tickAsync(0)
		assert.equal(outcome.state, 'resolved')
	})

	it('rejects over TCP when the L_Data.con is missing', async () => {
		const h = setup({ hostProtocol: 'TunnelTCP' })
		const outcome = track(h.client.write('0/0/1', true, '1.001'))
		await clock.tickAsync(3000)
		assert.equal(outcome.state, 'rejected')
		assert.ok(outcome.error instanceof RequestTimeoutError)
	})

	it('resolves on routing once the frame left, after a ROUTING_BUSY pause', async () => {
		sinon.stub(Math, 'random').returns(0)
		const h = setup({ hostProtocol: 'Multicast', ipAddr: '224.0.23.12' })
		h.receive(new KNXRoutingBusy(100).toBuffer())
		const outcome = track(h.client.write('0/0/1', true, '1.001'))
		await clock.tickAsync(99)
		assert.equal(outcome.state, 'pending')
		await clock.tickAsync(1)
		assert.equal(outcome.state, 'resolved')
		assert.deepEqual(
			h.sent.map((p) => [p.time, p.type]),
			[[100, KNX_CONSTANTS.ROUTING_INDICATION]],
		)
	})
})
