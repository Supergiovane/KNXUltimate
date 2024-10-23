import { test, describe } from 'node:test'
import assert from 'node:assert'
import { KNXClient, KNXClientEvents, SnifferPacket } from '../../src'
import MockKNXServer from 'test/utils/MockKNXServer'
import { wait } from 'src/utils'
import { networkInterfaces } from 'node:os'

const TEST_TIMEOUT = undefined

const ciIP = '192.168.1.58'

function getDefaultIpLocal() {
	if (process.env.CI) {
		return ciIP
	}

	const interfaces = networkInterfaces()

	for (const iface in interfaces) {
		for (const intf of interfaces[iface]) {
			if (
				intf.family === 'IPv4' &&
				!intf.internal &&
				intf.address !== '::1'
			) {
				return intf.address
			}
		}
	}

	return null
}

function ipToHex(ip: string) {
	return Buffer.from(ip.split('.').map(Number)).toString('hex')
}

const getMockResponses = (): SnifferPacket[] => {
	const localIp = getDefaultIpLocal()
	const knxGwIp = ipToHex(MockKNXServer.host)

	if (!localIp) {
		throw new Error('No local IP found')
	}

	// convert real IP to hex
	const reqIPHex = ipToHex(localIp)

	return [
		{
			request: `06100201000e0801${reqIPHex}0e57`,
			response: `06100202004e0801${knxGwIp}0e5736010200af010000006c00769395e000170c006c007693954b4e582049502053656375726520427269646765000000000000000000000a020201030104010501`,
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
			const client = new KNXClient(
				{
					loglevel: 'trace',
					hostProtocol: 'Multicast',
				},
				(c: KNXClient) => {
					const server = new MockKNXServer(getMockResponses(), c)
					server.createFakeSocket()
					c.startDiscovery()
				},
			)

			const discovered: string[] = []

			// Handle client errors
			client.on(KNXClientEvents.error, (error) => {
				// ignore ENODEV errors, it happens on CI
				if ((error as any).code !== 'ENODEV') {
					throw error
				}
			})

			// Handle successful discoveries
			client.on(KNXClientEvents.discover, (host) => {
				discovered.push(host)
			})

			await wait(50)

			// Verify discovery results
			const expectedHost = `${MockKNXServer.host}:${MockKNXServer.port}`
			assert.equal(discovered[0], expectedHost, 'Discovery should work')

			await client.Disconnect()
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
