import { test, describe, beforeEach, afterEach, before, after } from 'node:test'
import assert from 'node:assert'
import { KNXClient, KNXClientEvents, KNXAddress } from '../../src'
import MockKNXServer from 'test/utils/MockKNXServer'
import { wait } from 'src/utils'

const TEST_TIMEOUT = 30000
const TEST_GROUP_ADDRESS = '0/1'

describe('KNXClient Tests', () => {
	test(
		'should discover KNX interfaces',
		{ timeout: TEST_TIMEOUT },
		async () => {
			const client = new KNXClient({
				hostProtocol: 'Multicast',
			})

			const discovered: string[] = []

			client.on(KNXClientEvents.discover, (host) => {
				discovered.push(host)
			})

			client.on(KNXClientEvents.socketCreated, (socket) => {
				const mockServer = new MockKNXServer(
					[
						{
							request: '06100201000e0801c0a8013a0e57',
							response: '06100201000e0801c0a8013a0e57',
							deltaReq: 0,
							deltaRes: 10,
						},
					],
					socket,
				)
			})

			client.startDiscovery()

			await wait(1000) // FIX: replace using Sinon fake timers
			await client.Disconnect()

			assert.equal(
				discovered[0],
				'192.168.1.116:3671',
				'Discovery should work',
			)
		},
	)

	// test(
	// 	'should disconnect from KNX bus',
	// 	{ timeout: TEST_TIMEOUT },

	// 	() => {
	// 		return new Promise<void>((resolve) => {
	// 			client.on(KNXClientEvents.connected, async () => {
	// 				assert.strictEqual(
	// 					client.isConnected(),
	// 					true,
	// 					'Client should be connected before disconnecting',
	// 				)
	// 				await client.Disconnect()
	// 				assert.strictEqual(
	// 					client.isConnected(),
	// 					false,
	// 					'Client should be disconnected',
	// 				)
	// 				logSniffedBuffers('disconnect')
	// 				resolve()
	// 			})

	// 			client.Connect()
	// 		})
	// 	},
	// )

	// test(
	// 	'should write to KNX bus',
	// 	{
	// 		timeout: TEST_TIMEOUT,
	// 	},
	// 	() => {
	// 		return new Promise<void>((resolve, reject) => {
	// 			client.on(KNXClientEvents.connected, () => {
	// 				const dstAddress =
	// 					KNXAddress.createFromString(TEST_GROUP_ADDRESS)
	// 				const value = Buffer.from([0x01])
	// 				client.write(dstAddress, value, '1.001')

	// 				setTimeout(() => {
	// 					logSniffedBuffers('write')
	// 					const sniffedBuffers = client.getSniffingBuffers()
	// 					try {
	// 						assert.ok(
	// 							sniffedBuffers.length > 0,
	// 							'Should have captured at least one message',
	// 						)
	// 						assert.ok(
	// 							sniffedBuffers[0].request,
	// 							'Should have captured a request',
	// 						)
	// 						assert.ok(
	// 							sniffedBuffers[0].response,
	// 							'Should have captured a response',
	// 						)
	// 						resolve()
	// 					} catch (error) {
	// 						reject(error)
	// 					}
	// 				}, 1000)
	// 			})

	// 			client.Connect()
	// 		})
	// 	},
	// )

	// test('should read from KNX bus', { timeout: TEST_TIMEOUT }, () => {
	// 	return new Promise<void>((resolve, reject) => {
	// 		client.on(KNXClientEvents.connected, () => {
	// 			const dstAddress =
	// 				KNXAddress.createFromString(TEST_GROUP_ADDRESS)
	// 			client.read(dstAddress)

	// 			setTimeout(() => {
	// 				logSniffedBuffers('read')
	// 				const sniffedBuffers = client.getSniffingBuffers()
	// 				try {
	// 					assert.ok(
	// 						sniffedBuffers.length > 0,
	// 						'Should have captured at least one message',
	// 					)
	// 					assert.ok(
	// 						sniffedBuffers[0].request,
	// 						'Should have captured a request',
	// 					)
	// 					assert.ok(
	// 						sniffedBuffers[0].response,
	// 						'Should have captured a response',
	// 					)
	// 					resolve()
	// 				} catch (error) {
	// 					reject(error)
	// 				}
	// 			}, 1000)
	// 		})

	// 		client.Connect()
	// 	})
	// })

	// test(
	// 	'should clear sniffing buffers',
	// 	{ timeout: TEST_TIMEOUT },

	// 	() => {
	// 		return new Promise<void>((resolve, reject) => {
	// 			client.on(KNXClientEvents.connected, () => {
	// 				const dstAddress =
	// 					KNXAddress.createFromString(TEST_GROUP_ADDRESS)
	// 				client.read(dstAddress)

	// 				setTimeout(() => {
	// 					logSniffedBuffers('before clearing')
	// 					let sniffedBuffers = client.getSniffingBuffers()
	// 					try {
	// 						assert.ok(
	// 							sniffedBuffers.length > 0,
	// 							'Should have captured messages',
	// 						)
	// 						client.clearSniffingBuffers()
	// 						sniffedBuffers = client.getSniffingBuffers()
	// 						assert.strictEqual(
	// 							sniffedBuffers.length,
	// 							0,
	// 							'Sniffing buffers should be empty after clearing',
	// 						)
	// 						logSniffedBuffers('after clearing')
	// 						resolve()
	// 					} catch (error) {
	// 						reject(error)
	// 					}
	// 				}, 1000)
	// 			})

	// 			client.Connect()
	// 		})
	// 	},
	// )
})
