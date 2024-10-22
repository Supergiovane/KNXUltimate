import { test, describe, beforeEach, afterEach, before, after } from 'node:test'
import assert from 'node:assert'
import { KNXClient, KNXClientEvents, KNXAddress } from '../../src'
import MockKNXServer from 'test/utils/MockKNXServer'
import { wait } from 'src/utils'

const TEST_TIMEOUT = 30000
const TEST_GROUP_ADDRESS = '0/1'

// Helper function to get expected response based on environment
function getDiscoveryResponses() {
	const isCI = process.env.CI === 'true'

	if (isCI) {
		return [
			{
				// CI request (using loopback)
				request: '06100201000e08017f0000010e57',
				// Response should use same address format as request
				response:
					'06100202004e08017f0000010e5736010200af010000006c00769395e000170c006c007693954b4e582049502053656375726520427269646765000000000000000000000a020201030104010501',
				deltaReq: 0,
				deltaRes: 10,
			},
		]
	}

	return [
		{
			// Local request (using network interface)
			request: '06100201000e0801c0a8013a0e57',
			// Response with KNX interface address
			response:
				'06100202004e0801c0a801740e5736010200af010000006c00769395e000170c006c007693954b4e582049502053656375726520427269646765000000000000000000000a020201030104010501',
			deltaReq: 0,
			deltaRes: 10,
		},
	]
}

describe('KNXClient Tests', () => {
	test(
		'should discover KNX interfaces',
		{ timeout: TEST_TIMEOUT },
		async () => {
			console.log('[TEST] Starting discovery test')
			console.log('[TEST] Running in CI:', process.env.CI === 'true')

			const client = new KNXClient({
				loglevel: 'trace',
				hostProtocol: 'Multicast',
			})
			console.log('[TEST] KNXClient initialized')

			const discovered: string[] = []

			client.on(KNXClientEvents.error, (error) => {
				console.error('[TEST] Client error:', error)
			})

			client.on(KNXClientEvents.discover, (host) => {
				console.log('[TEST] Host discovered:', host)
				discovered.push(host)
			})

			client.on(KNXClientEvents.socketCreated, (socket) => {
				console.log('[TEST] Socket created, initializing mock server')
				const responses = getDiscoveryResponses()
				console.log(
					'[TEST] Mock responses:',
					JSON.stringify(responses, null, 2),
				)
				const mockServer = new MockKNXServer(responses, socket)
			})

			console.log('[TEST] Starting discovery')
			client.startDiscovery()

			console.log('[TEST] Waiting 1000ms...')
			await wait(1000)

			console.log('Discovered hosts:', discovered)

			await client.Disconnect()
			console.log('[TEST] Client disconnected')

			// Check discovery results
			const expectedHost =
				process.env.CI === 'true'
					? '127.0.0.1:3671'
					: '192.168.1.116:3671'
			assert.equal(discovered[0], expectedHost, 'Discovery should work')
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
