/**
 * Regression tests for KNXClient edge cases.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { afterEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { Socket as TCPSocket } from 'net'
import KNXClient, {
	ConncetionState,
	KNXClientEvents,
} from '../../src/KNXClient'

const clientsToCleanup: KNXClient[] = []

function createQueuedPacket(
	queueKind: 'groupWrite' | 'groupResponse' | 'groupRead' | 'other' = 'other',
	groupAddress?: string,
) {
	return {
		type: 0x0420,
		cEMIMessage: {
			dstAddress: {
				toString: () => groupAddress,
			},
			npdu: {
				isGroupWrite: queueKind === 'groupWrite',
				isGroupResponse: queueKind === 'groupResponse',
				isGroupRead: queueKind === 'groupRead',
			},
		},
	} as any
}

function createQueueItem(
	packet: any,
	overrides: Partial<Record<string, any>> = {},
) {
	return {
		knxPacket: packet,
		ACK: undefined as any,
		expectedSeqNumberForACK: 0,
		enqueuedAt: Date.now(),
		queueKind: 'other',
		groupAddress: undefined,
		priority: false,
		...overrides,
	}
}

function withTimeout<T>(promise: Promise<T>, ms = 500): Promise<T> {
	return Promise.race<T>([
		promise,
		new Promise<T>((_, reject) => {
			const timer = setTimeout(
				() => reject(new Error(`Timed out after ${ms}ms`)),
				ms,
			)
			timer.unref?.()
		}),
	])
}

afterEach(async () => {
	while (clientsToCleanup.length > 0) {
		const client = clientsToCleanup.pop()
		try {
			;(client as any).clearAllTimers?.()
		} catch {}
		try {
			;(client as any)._clientSocket?.removeAllListeners?.()
		} catch {}
		try {
			;(client as any)._clientSocket?.unref?.()
		} catch {}
		try {
			;(client as any)._clientSocket?.destroy?.()
		} catch {}
		try {
			;(client as any)._clientSocket?.close?.()
		} catch {}
		try {
			client.removeAllListeners()
		} catch {}
	}
})

describe('KNXClient regressions', () => {
	test('setDisconnected should resolve even when no socket is present', async () => {
		const client = new KNXClient({
			hostProtocol: 'TunnelTCP',
			loglevel: 'error',
		})
		clientsToCleanup.push(client)
		client['_connectionState'] = ConncetionState.CONNECTED

		await assert.doesNotReject(
			withTimeout((client as any).setDisconnected('no socket')),
		)
		assert.equal(client['_connectionState'], ConncetionState.DISCONNECTED)
	})

	test('setDisconnected should resolve for TCP sockets', async () => {
		const client = new KNXClient({
			hostProtocol: 'TunnelTCP',
			loglevel: 'error',
		})
		clientsToCleanup.push(client)
		client['_connectionState'] = ConncetionState.CONNECTED
		client['_clientSocket'] = new TCPSocket()
		client['_clientSocket'].unref()

		await assert.doesNotReject(
			withTimeout((client as any).setDisconnected('tcp close')),
		)
		assert.equal(client['_connectionState'], ConncetionState.DISCONNECTED)
		assert.equal(client['_clientSocket'], null)
	})

	test('handleKNXQueue should keep pending items after a send failure', async () => {
		const client = new KNXClient({
			hostProtocol: 'TunnelUDP',
			loglevel: 'error',
		})
		clientsToCleanup.push(client)

		const remaining = {
			...createQueueItem(createQueuedPacket(), {
				expectedSeqNumberForACK: 2,
			}),
		}
		const failing = {
			...createQueueItem(createQueuedPacket(), {
				expectedSeqNumberForACK: 1,
			}),
		}

		client['_clearToSend'] = true
		client['socketReady'] = true
		client['commandQueue'] = [remaining, failing]
		client['processKnxPacketQueueItem'] = async () => false

		await (client as any).handleKNXQueue()

		assert.deepEqual(client['commandQueue'], [remaining])
		assert.equal(client['queueLock'], false)
	})

	test('send should coalesce queued writes for the same GA', () => {
		const client = new KNXClient({
			hostProtocol: 'TunnelUDP',
			loglevel: 'error',
		})
		clientsToCleanup.push(client)
		client['handleKNXQueue'] = () => Promise.resolve()

		const oldPacket = createQueuedPacket('groupWrite', '1/2/3')
		const newPacket = createQueuedPacket('groupWrite', '1/2/3')

		client.send(oldPacket, undefined, false, 1)
		client.send(newPacket, undefined, false, 2)

		assert.equal(client['commandQueue'].length, 1)
		assert.equal(client['commandQueue'][0].knxPacket, newPacket)
		assert.equal(client['commandQueue'][0].groupAddress, '1/2/3')
		assert.equal(client['commandQueue'][0].queueKind, 'groupWrite')
	})

	test('handleKNXQueue should drop stale queued responses before send', async () => {
		const client = new KNXClient({
			hostProtocol: 'TunnelUDP',
			loglevel: 'error',
			KNXQueueMaxGroupResponseAgeMilliseconds: 10,
		})
		clientsToCleanup.push(client)
		let sentCount = 0

		client['_clearToSend'] = true
		client['socketReady'] = true
		client['commandQueue'] = [
			createQueueItem(createQueuedPacket('groupResponse', '2/1/10'), {
				queueKind: 'groupResponse',
				groupAddress: '2/1/10',
				enqueuedAt: Date.now() - 50,
			}),
		]
		client['processKnxPacketQueueItem'] = async () => {
			sentCount += 1
			return true
		}

		await (client as any).handleKNXQueue()

		assert.equal(sentCount, 0)
		assert.deepEqual(client['commandQueue'], [])
	})

	test('handleKNXQueue should not expire priority telegrams', async () => {
		const client = new KNXClient({
			hostProtocol: 'TunnelUDP',
			loglevel: 'error',
			KNXQueueMaxTelegramAgeMilliseconds: 1,
		})
		clientsToCleanup.push(client)
		let sentCount = 0

		client['_clearToSend'] = true
		client['socketReady'] = true
		client['commandQueue'] = [
			createQueueItem(createQueuedPacket(), {
				queueKind: 'priority',
				priority: true,
				enqueuedAt: Date.now() - 50,
			}),
		]
		client['processKnxPacketQueueItem'] = async () => {
			sentCount += 1
			return true
		}

		await (client as any).handleKNXQueue()

		assert.equal(sentCount, 1)
		assert.deepEqual(client['commandQueue'], [])
	})

	test('secure handshake timeouts should emit error and disconnect', async () => {
		const client = new KNXClient({
			hostProtocol: 'TunnelTCP',
			loglevel: 'error',
		})
		clientsToCleanup.push(client)
		client['_connectionState'] = ConncetionState.CONNECTING
		client['_clientSocket'] = new TCPSocket()
		client['_clientSocket'].unref()

		const errorPromise = new Promise<Error>((resolve) => {
			client.once(KNXClientEvents.error, resolve)
		})
		const disconnectedPromise = new Promise<string>((resolve) => {
			client.once(KNXClientEvents.disconnected, resolve)
		})

		;(client as any).handleSecureHandshakeTimeout(
			'Timeout waiting for SESSION_RESPONSE',
		)

		const error = await withTimeout(errorPromise)
		const disconnectedReason = await withTimeout(disconnectedPromise)

		assert.match(error.message, /Timeout waiting for SESSION_RESPONSE/)
		assert.match(disconnectedReason, /Timeout waiting for SESSION_RESPONSE/)
		assert.equal(client['_connectionState'], ConncetionState.DISCONNECTED)
	})

	test('clearAllTimers should clear secure timers too', async () => {
		const client = new KNXClient({
			hostProtocol: 'TunnelTCP',
			loglevel: 'error',
		})
		clientsToCleanup.push(client)
		let fired = false

		client['_secureHandshakeSessionTimer'] = setTimeout(() => {
			fired = true
		}, 20)
		client['_secureHandshakeAuthTimer'] = setTimeout(() => {
			fired = true
		}, 20)
		client['_secureHandshakeConnectTimer'] = setTimeout(() => {
			fired = true
		}, 20)
		client['_secureRoutingSyncTimer'] = setTimeout(() => {
			fired = true
		}, 20)
		;(client as any).clearAllTimers()
		await new Promise((resolve) => {
			setTimeout(resolve, 60)
		})

		assert.equal(fired, false)
		assert.equal(client['_secureHandshakeSessionTimer'], undefined)
		assert.equal(client['_secureHandshakeAuthTimer'], undefined)
		assert.equal(client['_secureHandshakeConnectTimer'], undefined)
		assert.equal(client['_secureRoutingSyncTimer'], undefined)
		assert.equal(client['_secureHandshakeState'], undefined)
	})

	test('processInboundMessage should emit error when indication decoding fails', async () => {
		const client = new KNXClient({
			hostProtocol: 'TunnelUDP',
			loglevel: 'error',
		})
		clientsToCleanup.push(client)
		client['_channelID'] = 0x51
		client['send'] = () => {}
		client['ensurePlainCEMI'] = () => {
			throw new Error('broken secure wrapper')
		}

		const errorPromise = new Promise<Error>((resolve) => {
			client.once(KNXClientEvents.error, resolve)
		})

		;(client as any).processInboundMessage(
			Buffer.from('061004200015045101002900bce0af020101010081', 'hex'),
			{
				address: '192.168.1.10',
				port: 3671,
				family: 'IPv4',
				size: 21,
			},
		)

		const error = await withTimeout(errorPromise)
		assert.match(
			error.message,
			/Inbound TUNNELING_REQUEST processing failed/,
		)
		assert.match(error.message, /broken secure wrapper/)
	})
})
