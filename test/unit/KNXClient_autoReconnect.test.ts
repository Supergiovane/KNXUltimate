import assert from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import sinon from 'sinon'

import KNXClient, {
	ConncetionState,
	KNXClientEvents,
} from '../../src/KNXClient'

describe('KNXClient autoReconnect', () => {
	let clock: sinon.SinonFakeTimers

	afterEach(() => {
		clock?.restore()
	})

	it('recreates the socket and reconnects after an unexpected disconnection', async () => {
		clock = sinon.useFakeTimers()
		let socketCreations = 0
		let connectingEvents = 0

		const client = new KNXClient(
			{
				autoReconnect: true,
				hostProtocol: 'TunnelUDP',
				ipAddr: '192.0.2.1',
				localIPAddress: '127.0.0.1',
				loglevel: 'disable',
			},
			(instance) => {
				socketCreations += 1
				instance['_clientSocket'] = {
					close: (callback: () => void) => callback(),
				} as any
				instance['socketReady'] = false
			},
		)

		client.on(KNXClientEvents.connecting, () => {
			connectingEvents += 1
		})

		client.Connect()
		await client['setDisconnected']('test connection loss')

		assert.strictEqual(socketCreations, 1)
		assert.strictEqual(client.isConnected(), false)

		await clock.tickAsync(4999)
		assert.strictEqual(socketCreations, 1)

		await clock.tickAsync(1)
		assert.strictEqual(socketCreations, 2)
		assert.strictEqual(connectingEvents, 2)
		assert.strictEqual(
			client['_connectionState'],
			ConncetionState.CONNECTING,
		)

		await client.Disconnect()
	})

	it('stops a pending reconnect when Disconnect() is called', async () => {
		clock = sinon.useFakeTimers()
		let socketCreations = 0

		const client = new KNXClient(
			{
				autoReconnect: true,
				hostProtocol: 'TunnelUDP',
				ipAddr: '192.0.2.1',
				localIPAddress: '127.0.0.1',
				loglevel: 'disable',
			},
			(instance) => {
				socketCreations += 1
				instance['_clientSocket'] = {
					close: (callback: () => void) => callback(),
				} as any
				instance['socketReady'] = false
			},
		)

		client.Connect()
		await client['setDisconnected']('test connection loss')
		await client.Disconnect()
		await clock.tickAsync(5000)

		assert.strictEqual(socketCreations, 1)
		assert.strictEqual(
			client['_connectionState'],
			ConncetionState.DISCONNECTED,
		)
	})

	it('keeps retrying when a reconnect attempt also times out', async () => {
		clock = sinon.useFakeTimers()
		let socketCreations = 0

		const client = new KNXClient(
			{
				autoReconnect: true,
				hostProtocol: 'TunnelUDP',
				ipAddr: '192.0.2.1',
				localIPAddress: '127.0.0.1',
				loglevel: 'disable',
			},
			(instance) => {
				socketCreations += 1
				instance['_clientSocket'] = {
					close: (callback: () => void) => callback(),
				} as any
				instance['socketReady'] = false
			},
		)

		client.Connect()
		await clock.tickAsync(10000)
		assert.strictEqual(
			client['_connectionState'],
			ConncetionState.DISCONNECTED,
		)

		await clock.tickAsync(5000)
		assert.strictEqual(socketCreations, 2)
		assert.strictEqual(
			client['_connectionState'],
			ConncetionState.CONNECTING,
		)

		await clock.tickAsync(10000)
		await clock.tickAsync(5000)
		assert.strictEqual(socketCreations, 3)
		assert.strictEqual(
			client['_connectionState'],
			ConncetionState.CONNECTING,
		)

		await client.Disconnect()
	})
})
