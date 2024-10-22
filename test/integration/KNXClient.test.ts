import { test, describe, beforeEach, afterEach, before, after } from 'node:test'
import assert from 'node:assert'
import { KNXClient, KNXClientEvents, KNXAddress } from '../../src'
import MockKNXServer from 'test/utils/MockKNXServer'
import { wait } from 'src/utils'

const TEST_TIMEOUT = 3000
const TEST_GROUP_ADDRESS = '0/1'

// Mock response templates based on environment
const getMockResponses = () => [
	{
		request: '06100201000e08017f0000010e57',
		response:
			'06100202004e08017f0000010e5736010200af010000006c00769395e000170c006c007693954b4e582049502053656375726520427269646765000000000000000000000a020201030104010501',
		deltaReq: 0,
		deltaRes: 10,
	},
]

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
			let mockServer: MockKNXServer

			try {
				// Set up discovery promise
				const discoveryPromise = new Promise<void>(
					(resolve, reject) => {
						// Handle client errors
						client.on(KNXClientEvents.error, (error) => {
							console.error('[TEST] Client error:', error)
							reject(error)
						})

						// Handle successful discoveries
						client.on(KNXClientEvents.discover, (host) => {
							console.log('[TEST] Host discovered:', host)
							discovered.push(host)
							resolve()
						})

						// Initialize mock server when socket is ready
						client.on(KNXClientEvents.socketCreated, (socket) => {
							console.log(
								'[TEST] Socket created, initializing mock server',
							)
							const responses = getMockResponses()
							console.log(
								'[TEST] Mock responses:',
								JSON.stringify(responses, null, 2),
							)
							mockServer = new MockKNXServer(responses, socket)
						})

						// Start discovery process
						console.log('[TEST] Starting discovery')
						client.startDiscovery()
					},
				)

				// Wait for discovery to complete
				await discoveryPromise

				// Verify discovery results
				console.log('[TEST] Verifying discovered hosts:', discovered)
				const expectedHost =
					process.env.CI === 'true'
						? '127.0.0.1:3671'
						: '192.168.1.116:3671'
				assert.equal(
					discovered[0],
					expectedHost,
					'Discovery should work',
				)
			} catch (error) {
				console.error('[TEST] Test failed:', error)
				throw error
			} finally {
				// Ensure cleanup happens regardless of test outcome
				console.log('[TEST] Cleaning up...')
				try {
					await client.Disconnect()
					console.log('[TEST] Client disconnected successfully')
				} catch (error) {
					console.error('[TEST] Error during cleanup:', error)
				}
			}
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
