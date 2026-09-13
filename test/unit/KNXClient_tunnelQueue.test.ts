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
import KNXPacket from '../../src/protocol/KNXPacket'
import KNXTunnelingRequest from '../../src/protocol/KNXTunnelingRequest'
import KNXConnectionStateResponse from '../../src/protocol/KNXConnectionStateResponse'
import { KNX_CONSTANTS } from '../../src/protocol/KNXConstants'

describe('KNXClient TunnelUDP queue and acknowledgements', () => {
	let clock: sinon.SinonFakeTimers
	let clients: KNXClient[]

	beforeEach(() => {
		clock = sinon.useFakeTimers({
			toFake: ['Date', 'setTimeout', 'clearTimeout'],
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
			client['exitProcessingKNXQueueLoop'] = true
			client['clearAllTimers']()
		}
		clock.restore()
		sinon.restore()
	})

	function setup(options: Partial<KNXClientOptions> = {}) {
		const sent: {
			time: number
			type: number
			seq: number
			buffer: Buffer
		}[] = []
		const errors: Error[] = []
		const acknowledgements: { seq: number; success: boolean }[] = []
		const socket = sinon.createStubInstance(UDPSocket)
		socket.send.callsFake((buffer: Buffer, ...args: any[]) => {
			const { knxHeader, knxMessage } = KNXProtocol.parseMessage(buffer)
			sent.push({
				time: clock.now,
				type: knxHeader.service_type,
				seq: (knxMessage as KNXTunnelingRequest).seqCounter,
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
				hostProtocol: 'TunnelUDP',
				ipAddr: '192.0.2.1',
				physAddr: '1.0.39',
				loglevel: 'disable',
				KNXQueueSendIntervalMilliseconds: 100,
				...options,
			},
			(instance) => {
				instance['_clientSocket'] = socket
			},
		)
		clients.push(client)
		client['_connectionState'] = ConncetionState.CONNECTED
		client['_channelID'] = 81
		client['_clientTunnelSeqNumber'] = 193
		client['socketReady'] = true
		client.clearToSend = true
		client.on(KNXClientEvents.error, (error) => errors.push(error))
		client.on(KNXClientEvents.ackReceived, (packet, success) => {
			acknowledgements.push({ seq: packet.seqCounter, success })
		})

		const receive = (packet: KNXPacket | Buffer) => {
			client['processInboundMessage'](
				Buffer.isBuffer(packet) ? packet : packet.toBuffer(),
				{ address: '192.0.2.1', port: 3671, family: 'IPv4', size: 0 },
			)
		}
		const write = (value = true) => client.write('0/0/1', value, '1.001')
		const ack = (seq: number) => {
			receive(KNXProtocol.newKNXTunnelingACK(81, seq, 0))
		}
		const requests = () =>
			sent.filter(
				(packet) => packet.type === KNX_CONSTANTS.TUNNELING_REQUEST,
			)
		const heartbeat = () => {
			client['_heartbeatRunning'] = true
			client['runHeartbeat']()
		}
		return {
			client,
			socket,
			sent,
			errors,
			acknowledgements,
			receive,
			write,
			ack,
			requests,
			heartbeat,
		}
	}

	it('allows Node-RED to log a busy queue and enqueue the next periodic telegram', async () => {
		const h = setup()
		const warnings: string[] = []
		const sendPeriodicTelegram = (value: boolean) => {
			if (!h.client.clearToSend) {
				warnings.push(
					`Waiting for telegram ACK with sequence ${h.client.getCurrentItemHandledByTheQueue()}`,
				)
			}
			h.write(value)
		}

		sendPeriodicTelegram(true)
		await clock.tickAsync(100)
		assert.doesNotThrow(() => sendPeriodicTelegram(false))
		assert.deepEqual(warnings, [
			'Waiting for telegram ACK with sequence 194',
		])
		assert.equal(h.client.getCurrentItemHandledByTheQueue(), 194)
		assert.deepEqual(
			h.requests().map((p) => p.seq),
			[194],
		)

		h.heartbeat()
		await clock.tickAsync(900)
		assert.equal(h.client.getCurrentItemHandledByTheQueue(), 194)
		assert.equal(h.client.clearToSend, false)
		assert.deepEqual(
			h.requests().map((p) => p.seq),
			[194, 194],
		)
		h.ack(194)
		await clock.tickAsync(100)
		assert.equal(h.client.getCurrentItemHandledByTheQueue(), 195)
		assert.deepEqual(
			h.requests().map((p) => p.seq),
			[194, 194, 195],
		)
		h.ack(195)
		assert.equal(h.client.getCurrentItemHandledByTheQueue(), undefined)
		assert.deepEqual(h.errors, [])
	})

	it('safely reports no pending ACK before sending or after disconnecting', async () => {
		const h = setup()
		h.client.clearToSend = false
		assert.equal(h.client.getCurrentItemHandledByTheQueue(), undefined)
		h.client.clearToSend = true
		h.write()
		assert.equal(h.client.getCurrentItemHandledByTheQueue(), 194)

		const disconnected = h.client.Disconnect()
		h.receive(KNXProtocol.newKNXDisconnectResponse(81, 0))
		await disconnected
		assert.equal(h.client.getCurrentItemHandledByTheQueue(), undefined)
	})

	const intervals = [25, 100]
	intervals.forEach((interval) => {
		it(`keeps the original request pending across a heartbeat with a ${interval} ms queue`, async () => {
			const h = setup({ KNXQueueSendIntervalMilliseconds: interval })
			h.write()
			h.write(false)
			await clock.tickAsync(400)
			const ackTimer = h.client['timers'].get(KNXTimer.ACK)

			h.heartbeat()
			h.receive(new KNXConnectionStateResponse(81, 0))
			assert.equal(h.sent[1].type, KNX_CONSTANTS.CONNECTIONSTATE_REQUEST)
			assert.equal(h.sent[1].time, 400)
			assert.equal(h.client.clearToSend, false)
			assert.equal(h.client['timers'].get(KNXTimer.ACK), ackTimer)
			await clock.tickAsync(599)
			assert.equal(h.requests().length, 1)
			await clock.tickAsync(1)
			assert.deepEqual(
				h.requests().map((p) => p.seq),
				[194, 194],
			)
			assert.deepEqual(h.requests()[0].buffer, h.requests()[1].buffer)
			assert.equal(h.requests()[1].time, 1000)

			h.ack(194)
			await clock.tickAsync(interval)
			assert.deepEqual(
				h.requests().map((p) => p.seq),
				[194, 194, 195],
			)
			assert.deepEqual(h.acknowledgements, [{ seq: 194, success: true }])
			assert.deepEqual(h.errors, [])
		})
	})

	it('sends incoming telegram ACKs immediately without changing the outstanding request', async () => {
		const h = setup({ sniffingMode: true })
		h.write()
		h.write(false)
		await clock.tickAsync(10)
		const ackTimer = h.client['timers'].get(KNXTimer.ACK)
		// Gateway L_DATA.ind and L_DATA.con on the same tunnel.
		h.receive(
			Buffer.from('061004200015045107002900bce0af020101010081', 'hex'),
		)
		h.receive(
			Buffer.from('061004200015045108002e00bce0af020101010081', 'hex'),
		)
		const acks = h.sent.filter(
			(p) => p.type === KNX_CONSTANTS.TUNNELING_ACK,
		)
		assert.deepEqual(
			acks.map((p) => [p.time, p.seq]),
			[
				[10, 7],
				[10, 8],
			],
		)
		assert.equal(h.client.clearToSend, false)
		assert.equal(h.client['timers'].get(KNXTimer.ACK), ackTimer)
		assert.equal(
			h.client['sniffingPackets'].filter(
				(p) => p.reqType === 'KNXTunnelingAck',
			).length,
			2,
		)
		await clock.tickAsync(990)
		assert.deepEqual(
			h.requests().map((p) => p.seq),
			[194, 194],
		)
		assert.deepEqual(h.requests()[0].buffer, h.requests()[1].buffer)
	})

	it('keeps application spacing independent of control traffic', async () => {
		const h = setup({ sniffingMode: true })
		h.write()
		h.write(false)
		h.write()
		await clock.tickAsync(10)
		h.ack(194)
		h.heartbeat()
		h.receive(
			Buffer.from('061004200015045107002900bce0af020101010081', 'hex'),
		)
		await clock.tickAsync(90)
		assert.deepEqual(
			h.requests().map((p) => p.time),
			[0, 100],
		)
		h.ack(195)
		await clock.tickAsync(100)
		assert.deepEqual(
			h.requests().map((p) => p.time),
			[0, 100, 200],
		)
		assert.ok(
			h.client['sniffingPackets'].some(
				(p) => p.reqType === 'KNXConnectionStateRequest',
			),
		)
	})

	it('does not let priority application traffic release a pending ACK', async () => {
		const h = setup()
		h.write()
		await clock.tickAsync(100)
		const original = h.client['pendingTunnelingRequest']
		const priority = KNXProtocol.newKNXTunnelingRequest(
			81,
			195,
			original.cEMIMessage,
		)
		h.client.send(priority, priority, true, 195)
		assert.equal(h.client.clearToSend, false)
		await clock.tickAsync(900)
		assert.deepEqual(
			h.requests().map((p) => p.seq),
			[194, 194],
		)
		h.ack(194)
		await clock.tickAsync(100)
		assert.deepEqual(
			h.requests().map((p) => p.seq),
			[194, 194, 195],
		)
	})

	const invalidACKs = [
		{ name: 'stale sequence', channel: 81, seq: 193, status: 0 },
		{ name: 'future sequence', channel: 81, seq: 195, status: 0 },
		{ name: 'wrong channel', channel: 82, seq: 194, status: 0 },
		{
			name: 'error status',
			channel: 81,
			seq: 194,
			status: KNX_CONSTANTS.E_SEQUENCE_NUMBER,
		},
	]
	invalidACKs.forEach((invalid) => {
		it(`ignores an ACK with ${invalid.name} and preserves retries`, async () => {
			const h = setup()
			h.write()
			h.write(false)
			await clock.tickAsync(1000)
			const ackTimer = h.client['timers'].get(KNXTimer.ACK)
			h.receive(
				KNXProtocol.newKNXTunnelingACK(
					invalid.channel,
					invalid.seq,
					invalid.status,
				),
			)
			assert.equal(h.client.clearToSend, false)
			assert.equal(h.client['timers'].get(KNXTimer.ACK), ackTimer)
			assert.equal(h.client['_numFailedTelegramACK'], 1)
			assert.deepEqual(h.acknowledgements, [])
			await clock.tickAsync(1000)
			assert.deepEqual(
				h.requests().map((p) => p.seq),
				[194, 194, 194],
			)
			h.ack(194)
			await clock.tickAsync(100)
			assert.deepEqual(
				h.requests().map((p) => p.seq),
				[194, 194, 194, 195],
			)
		})
	})

	it('ignores unsolicited and duplicate ACKs', async () => {
		const h = setup()
		h.client.clearToSend = false
		h.ack(193)
		assert.equal(h.client.clearToSend, false)
		assert.deepEqual(h.acknowledgements, [])
		h.client.clearToSend = true
		h.write()
		h.write(false)
		h.ack(194)
		await clock.tickAsync(100)
		const ackTimer = h.client['timers'].get(KNXTimer.ACK)
		h.ack(194)
		assert.equal(h.client['timers'].get(KNXTimer.ACK), ackTimer)
		assert.equal(h.client.clearToSend, false)
		h.ack(195)
		h.ack(195)
		assert.deepEqual(h.acknowledgements, [
			{ seq: 194, success: true },
			{ seq: 195, success: true },
		])
	})

	it('removes a queued retransmission when the ACK arrives before it is sent', async () => {
		const h = setup({ KNXQueueSendIntervalMilliseconds: 1500 })
		h.write()
		h.write(false)
		await clock.tickAsync(1100)
		assert.equal(h.requests().length, 1)
		h.ack(194)
		await clock.tickAsync(400)
		assert.deepEqual(
			h.requests().map((p) => [p.time, p.seq]),
			[
				[0, 194],
				[1500, 195],
			],
		)
	})

	it('matches the pending request across sequence counter wraparound', async () => {
		const h = setup()
		h.client['_clientTunnelSeqNumber'] = 254
		h.write()
		h.write(false)
		await clock.tickAsync(100)
		h.heartbeat()
		h.ack(0)
		assert.equal(h.client.getCurrentItemHandledByTheQueue(), 255)
		assert.deepEqual(
			h.requests().map((p) => p.seq),
			[255],
		)
		h.ack(255)
		await clock.tickAsync(100)
		assert.equal(h.client.getCurrentItemHandledByTheQueue(), 0)
		assert.deepEqual(
			h.requests().map((p) => p.seq),
			[255, 0],
		)
		h.ack(0)
		assert.equal(h.client['timers'].has(KNXTimer.ACK), false)
	})

	it('closes a tunnel after exhausted retries and allows automatic reconnection', async () => {
		const h = setup({ autoReconnect: true })
		h.client['_connectionRequested'] = true
		h.write()
		h.write(false)
		await clock.tickAsync(3000)
		assert.deepEqual(
			h.requests().map((p) => p.seq),
			[194, 194, 194],
		)
		assert.equal(
			h.sent[h.sent.length - 1].type,
			KNX_CONSTANTS.DISCONNECT_REQUEST,
		)
		assert.deepEqual(h.acknowledgements, [{ seq: 194, success: false }])
		assert.equal(h.errors.length, 1)
		assert.match(h.errors[0].message, /seqCounter:194/)
		assert.equal(h.client.isConnected(), false)
		assert.equal(h.client['pendingTunnelingRequest'], undefined)
		assert.equal(h.client['timers'].has(KNXTimer.ACK), false)
		assert.equal(h.socket.close.callCount, 1)
		assert.equal(h.client['timers'].has(KNXTimer.RECONNECT), true)
		await clock.tickAsync(5000)
		assert.equal(h.client['_connectionState'], ConncetionState.CONNECTING)
		assert.deepEqual(h.client['commandQueue'], [])
	})

	it('sends a local disconnect immediately and stops application traffic', async () => {
		const h = setup()
		h.write()
		h.write(false)
		await clock.tickAsync(10)
		const disconnected = h.client.Disconnect()
		assert.equal(h.sent[1].type, KNX_CONSTANTS.DISCONNECT_REQUEST)
		assert.equal(h.sent[1].time, 10)
		// A connected-event listener can disconnect before the initial heartbeat starts.
		h.client['startHeartBeat']()
		assert.equal(h.client['_heartbeatRunning'], false)
		assert.equal(h.sent.length, 2)
		h.receive(KNXProtocol.newKNXDisconnectResponse(81, 0))
		await disconnected
		await clock.tickAsync(3000)
		assert.deepEqual(
			h.requests().map((p) => p.seq),
			[194],
		)
		assert.equal(h.client['pendingTunnelingRequest'], undefined)
	})

	it('acknowledges a gateway disconnect without sending queued applications or retries', async () => {
		const h = setup()
		h.write()
		h.write(false)
		await clock.tickAsync(10)
		h.receive(KNXProtocol.newKNXDisconnectRequest(81))
		assert.equal(h.sent[1].type, KNX_CONSTANTS.DISCONNECT_RESPONSE)
		assert.equal(h.sent[1].time, 10)
		await clock.tickAsync(3000)
		assert.deepEqual(
			h.requests().map((p) => p.seq),
			[194],
		)
		assert.equal(h.client.isConnected(), false)
		assert.equal(h.client['pendingTunnelingRequest'], undefined)
	})

	const sendFailures = ['callback', 'throw', 'not ready']
	sendFailures.forEach((failure) => {
		it(`reports a control send failure (${failure}) without releasing the pending request`, async () => {
			const h = setup()
			h.write()
			await clock.tickAsync(10)
			const ackTimer = h.client['timers'].get(KNXTimer.ACK)
			if (failure === 'not ready') {
				h.client['socketReady'] = false
			} else {
				h.socket.send.callsFake((buffer: Buffer, ...args: any[]) => {
					const error = new Error('simulated UDP send failure')
					if (failure === 'throw') throw error
					args[args.length - 1](error)
				})
			}
			h.heartbeat()
			await clock.tickAsync(1)
			assert.equal(h.errors.length, 1)
			assert.equal(h.client.clearToSend, false)
			assert.equal(h.client['timers'].get(KNXTimer.ACK), ackTimer)
		})
	})

	it('preserves rate limiting when tunnelling ACK waiting is explicitly suppressed', async () => {
		const h = setup({ suppress_ack_ldatareq: true })
		h.write()
		h.write(false)
		await clock.tickAsync(10)
		h.heartbeat()
		h.ack(193)
		await clock.tickAsync(90)
		assert.deepEqual(
			h.requests().map((p) => p.time),
			[0, 100],
		)
		assert.equal(h.client['timers'].has(KNXTimer.ACK), false)
		assert.deepEqual(h.acknowledgements, [])
	})
})
