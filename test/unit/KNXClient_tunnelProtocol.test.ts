/**
 * Tunnelling protocol checks: channel id validation, repeated frames,
 * unparsable frames, heartbeat failure and connect retries.
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
	KNXTimer,
} from '../../src/KNXClient'
import KNXProtocol from '../../src/protocol/KNXProtocol'
import KNXConnectionStateResponse from '../../src/protocol/KNXConnectionStateResponse'
import { KNX_CONSTANTS } from '../../src/protocol/KNXConstants'
import LDataInd from '../../src/protocol/cEMI/LDataInd'

const CHANNEL = 81

// TUNNELING_REQUEST, channel 81, L_DATA_IND 1.1.1 -> 0/0/1 GroupValueWrite(1)
const tunnelingRequest = (seq: number, apci = 0x81) =>
	Buffer.from(
		`061004200015 0451${seq.toString(16).padStart(2, '0')}00 2900bce0110100010100${apci.toString(16)}`.replace(
			/\s/g,
			'',
		),
		'hex',
	)

describe('KNXClient tunnelling protocol checks', () => {
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

	function setup() {
		const sent: { type: number; buffer: Buffer }[] = []
		const socket = sinon.createStubInstance(UDPSocket)
		socket.send.callsFake((buffer: Buffer, ...args: any[]) => {
			sent.push({
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
				hostProtocol: 'TunnelUDP',
				ipAddr: '192.0.2.1',
				physAddr: '1.0.39',
				loglevel: 'disable',
			},
			(instance) => {
				instance['_clientSocket'] = socket
			},
		)
		clients.push(client)
		client['_connectionState'] = ConncetionState.CONNECTED
		client['_channelID'] = CHANNEL
		client['socketReady'] = true
		client.clearToSend = true
		const indications: number[] = []
		client.on(KNXClientEvents.indication, (packet: any) => {
			indications.push(packet.seqCounter)
		})
		const disconnects: string[] = []
		client.on(KNXClientEvents.disconnected, (reason) =>
			disconnects.push(reason),
		)
		client.on(KNXClientEvents.error, () => {})
		const receive = (buffer: Buffer) => {
			client['processInboundMessage'](buffer, {
				address: '192.0.2.1',
				port: 3671,
				family: 'IPv4',
				size: buffer.length,
			})
		}
		const sentOf = (type: number) => sent.filter((p) => p.type === type)
		return { client, sent, sentOf, indications, disconnects, receive }
	}

	it('ACKs a repeated TUNNELING_REQUEST but emits it only once', () => {
		const h = setup()
		h.receive(tunnelingRequest(7))
		h.receive(tunnelingRequest(7))
		h.receive(tunnelingRequest(8))
		assert.deepEqual(h.indications, [7, 8])
		assert.equal(h.sentOf(KNX_CONSTANTS.TUNNELING_ACK).length, 3)
	})

	it('ACKs but drops a different telegram that reuses the last sequence number', () => {
		const h = setup()
		h.receive(tunnelingRequest(7, 0x81))
		h.receive(tunnelingRequest(7, 0x80))
		assert.deepEqual(h.indications, [7])
		assert.equal(h.sentOf(KNX_CONSTANTS.TUNNELING_ACK).length, 2)
	})

	it('still ACKs and emits out-of-sequence telegrams (compatibility)', () => {
		const h = setup()
		h.receive(tunnelingRequest(7))
		h.receive(tunnelingRequest(9)) // gap
		h.receive(tunnelingRequest(3)) // older number
		assert.deepEqual(h.indications, [7, 9, 3])
		assert.equal(h.sentOf(KNX_CONSTANTS.TUNNELING_ACK).length, 3)
	})

	it('parses only the bytes declared in the KNX/IP header', () => {
		const h = setup()
		h.receive(
			Buffer.concat([tunnelingRequest(7), Buffer.from('dead', 'hex')]),
		)
		assert.deepEqual(h.indications, [7])
	})

	it('ACKs a TUNNELING_REQUEST of our channel whose cEMI cannot be parsed', () => {
		const h = setup()
		// cEMI truncated after the control field
		h.receive(
			Buffer.from(
				'06100420 000d 04510900 2900bc'.replace(/\s/g, ''),
				'hex',
			),
		)
		const acks = h.sentOf(KNX_CONSTANTS.TUNNELING_ACK)
		assert.equal(acks.length, 1)
		assert.equal(acks[0].buffer[7], CHANNEL)
		assert.equal(acks[0].buffer[8], 0x09)
		assert.deepEqual(h.indications, [])
	})

	it('ignores a DISCONNECT_RESPONSE for another channel', () => {
		const h = setup()
		h.receive(
			KNXProtocol.newKNXDisconnectResponse(CHANNEL + 1, 0).toBuffer(),
		)
		assert.equal(h.client.isConnected(), true)
		assert.deepEqual(h.disconnects, [])
		h.receive(KNXProtocol.newKNXDisconnectResponse(CHANNEL, 0).toBuffer())
		assert.equal(h.client.isConnected(), false)
	})

	it('ignores a DISCONNECT_RESPONSE for another channel while disconnecting', () => {
		const h = setup()
		h.client['_connectionState'] = ConncetionState.DISCONNECTING
		h.receive(
			KNXProtocol.newKNXDisconnectResponse(CHANNEL + 1, 0).toBuffer(),
		)
		assert.deepEqual(h.disconnects, [])
		h.receive(KNXProtocol.newKNXDisconnectResponse(CHANNEL, 0).toBuffer())
		assert.equal(h.disconnects.length, 1)
	})

	it('drops a frame shorter than its header length', () => {
		const h = setup()
		const frame = tunnelingRequest(7)
		frame.writeUInt16BE(frame.length + 4, 4)
		h.receive(frame)
		assert.deepEqual(h.indications, [])
		assert.equal(h.sentOf(KNX_CONSTANTS.TUNNELING_ACK).length, 0)
	})

	it('does not ACK an unparsable frame whose connection header is invalid', () => {
		const h = setup()
		// cEMI truncated after the control field, connection header length 5
		h.receive(
			Buffer.from(
				'06100420 000d 05510900 2900bc'.replace(/\s/g, ''),
				'hex',
			),
		)
		assert.equal(h.sentOf(KNX_CONSTANTS.TUNNELING_ACK).length, 0)
	})

	it('ignores a CONNECTIONSTATE_RESPONSE for another channel', () => {
		const h = setup()
		h.client['_heartbeatRunning'] = true
		h.client['runHeartbeat']()
		assert.equal(h.client['timers'].has(KNXTimer.CONNECTION_STATE), true)
		h.receive(new KNXConnectionStateResponse(CHANNEL + 1, 0).toBuffer())
		assert.equal(h.client['timers'].has(KNXTimer.CONNECTION_STATE), true)
		h.receive(new KNXConnectionStateResponse(CHANNEL, 0).toBuffer())
		assert.equal(h.client['timers'].has(KNXTimer.CONNECTION_STATE), false)
	})

	it('sends a DISCONNECT_REQUEST when the heartbeat fails', async () => {
		const h = setup()
		h.client['_heartbeatRunning'] = true
		h.client['_heartbeatFailures'] = 2
		h.client['runHeartbeat']()
		await clock.tickAsync(
			1000 * KNX_CONSTANTS.CONNECTIONSTATE_REQUEST_TIMEOUT,
		)
		const requests = h.sentOf(KNX_CONSTANTS.DISCONNECT_REQUEST)
		assert.equal(requests.length, 1)
		assert.equal(requests[0].buffer[6], CHANNEL)
		await clock.tickAsync(600)
		assert.equal(h.client.isConnected(), false)
		assert.equal(h.disconnects.length, 1)
	})

	it('backs off reconnecting after E_NO_MORE_CONNECTIONS', () => {
		const h = setup()
		h.client['_connectionState'] = ConncetionState.CONNECTING
		// CONNECT_RESPONSE, channel 0, status E_NO_MORE_CONNECTIONS
		const refused = Buffer.from('0610020600080024', 'hex')
		h.receive(refused)
		assert.equal(h.client['_reconnectBackoffMs'], 10000)
		h.client['_connectionState'] = ConncetionState.CONNECTING
		h.receive(refused)
		assert.equal(h.client['_reconnectBackoffMs'], 20000)
	})
})

describe('cEMI additional information', () => {
	it('keeps the additional information bytes and parses the rest correctly', () => {
		// L_DATA_IND with 4 bytes of additional info (type 03, len 02, 01 02)
		const cemi = Buffer.from(
			'2904030201 02bce0110100010100 81'.replace(/\s/g, ''),
			'hex',
		)
		const ind = LDataInd.createFromBuffer(cemi, 1)
		assert.deepEqual(
			ind.additionalInfo?.value,
			Buffer.from('03020102', 'hex'),
		)
		assert.equal(ind.srcAddress.toString(), '1.1.1')
		assert.equal(ind.dstAddress.toString(), '0/0/1')
	})
})
