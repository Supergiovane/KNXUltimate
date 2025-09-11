import { test, describe } from 'node:test'
import assert from 'node:assert'
import sinon from 'sinon'
import { dptlib, KNXClient, KNXClientEvents, SnifferPacket } from '../../src'
import { KNX_CONSTANTS } from '../../src/protocol/KNXConstants'
import MockKNXServer from 'test/utils/MockKNXServer'
import { networkInterfaces } from 'node:os'

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

const mockToggleResponses: SnifferPacket[] = [
	{
		reqType: 'KNXConnectRequest',
		request: '06100205001a0801000000000000080100000000000004040200',
		deltaReq: 0,
		response: '06100206001451000801c0a801740e570404affb',
		resType: 'KNXConnectResponse',
		deltaRes: 9,
	},
	{
		reqType: 'KNXConnectionStateRequest',
		request: '06100207001051000801000000000000',
		deltaReq: 11,
		response: '0610020800085100',
		resType: 'KNXConnectionStateResponse',
		deltaRes: 20,
	},
	// Toggle ON
	{
		reqType: 'KNXTunnelingRequest',
		request: '061004200015045100001100bce0ffc80001010081',
		deltaReq: 1581,
		response: '06100421000a04510000',
		resType: 'KNXTunnelingAck',
		deltaRes: 9,
	},
	{
		reqType: 'KNXTunnelingRequest',
		response: '061004200015045100002e00bce0affb0001010081',
		deltaReq: 44,
	},
	{
		reqType: 'KNXTunnelingAck',
		request: '06100421000a04510000',
		deltaReq: 44,
		response: '061004200015045101002900bce0af020101010081',
		resType: 'KNXTunnelingRequest',
		deltaRes: 670,
	},
	{
		reqType: 'KNXTunnelingAck',
		request: '06100421000a04510100',
		deltaReq: 671,
	},
	// Toggle OFF
	{
		reqType: 'KNXTunnelingRequest',
		request: '061004200015045101001100bce0ffc80001010080',
		deltaReq: 516,
		response: '06100421000a04510100',
		resType: 'KNXTunnelingAck',
		deltaRes: 7,
	},
	{
		reqType: 'KNXTunnelingRequest',
		response: '061004200015045102002e00bce0affb0001010080',
		deltaReq: 43,
	},
	{
		reqType: 'KNXTunnelingAck',
		request: '06100421000a04510200',
		deltaReq: 43,
		response: '061004200015045103002900bce0af020101010080',
		resType: 'KNXTunnelingRequest',
		deltaRes: 563,
	},
	{
		reqType: 'KNXTunnelingAck',
		request: '06100421000a04510300',
		deltaReq: 563,
	},
	// Disconnect
	{
		reqType: 'KNXDisconnectRequest',
		request: '06100209001051000801000000000000',
		deltaReq: 1250,
		response: '0610020a00085100',
		resType: 'KNXDisconnectResponse',
		deltaRes: 4,
	},
]

const getMockPacketsForDisconnectTest: SnifferPacket[] = [
	// Initial connection
	{
		reqType: 'KNXConnectRequest',
		request: '06100205001a0801000000000000080100000000000004040200',
		response: '06100206001424000801c0a801740e570404affc',
		deltaReq: 0,
		deltaRes: 8,
		resType: 'KNXConnectResponse',
	},
	// First successful heartbeat
	{
		reqType: 'KNXConnectionStateRequest',
		request: '06100207001024000801000000000000',
		response: '0610020800082400',
		deltaReq: 9,
		deltaRes: 21,
		resType: 'KNXConnectionStateResponse',
	},
	// First failed heartbeat during disconnection
	{
		reqType: 'KNXConnectionStateRequest',
		request: '06100207001024000801000000000000',
		deltaReq: 10005,
	},
	// Second failed heartbeat
	{
		reqType: 'KNXConnectionStateRequest',
		request: '06100207001024000801000000000000',
		deltaReq: 10001,
	},
	// Third failed heartbeat - should trigger disconnection
	{
		reqType: 'KNXConnectionStateRequest',
		request: '06100207001024000801000000000000',
		deltaReq: 10006,
	},
]

const getMockPacketsForDisconnectRequestTest: SnifferPacket[] = [
	// Initial connection
	{
		reqType: 'KNXConnectRequest',
		request: '06100205001a0801000000000000080100000000000004040200',
		response: '06100206001424000801c0a801740e570404affc',
		deltaReq: 0,
		deltaRes: 8,
		resType: 'KNXConnectResponse',
	},
	// Disconnect
	{
		reqType: 'KNXDisconnectRequest',
		request: '06100209001024000801000000000000',
		deltaReq: 500,
		response: '0610020a00085100',
		resType: 'KNXDisconnectResponse',
		deltaRes: 4,
	},
]

describe('KNXClient Tests', () => {
    test('should discover KNX interfaces', async () => {
		const clock = sinon.useFakeTimers({ shouldAdvanceTime: true })

		try {
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
			client.on(
				KNXClientEvents.discover,
				(host, header, searchResponse) => {
					discovered.push(
						`${host}:${searchResponse.deviceInfo?.name.replace(/:/g, ' ') ?? ''}:${searchResponse.deviceInfo?.formattedAddress ?? ''}`,
					)
				},
			)


            // Advance virtual time instead of waiting
            await clock.tickAsync(50)

			// Verify discovery results
			const expectedHost = `${MockKNXServer.host}:${MockKNXServer.port}:KNX IP Secure Bridge:10.15.1`
			assert.equal(discovered[0], expectedHost, 'Discovery should work')

			await client.Disconnect()
		} finally {
			// Restore real timers
			clock.restore()
		}
	})

    test('should perform toggle operation', async () => {
		const clock = sinon.useFakeTimers({ shouldAdvanceTime: true })
		const groupId = '0/0/1'
		const dpt = '1.001'
		let client: KNXClient

		const waitForIndication = async (expectedValue: any): Promise<void> => {
			return new Promise<void>((resolve) => {
				client.once('indication', (packet) => {
					const { npdu } = packet.cEMIMessage
					const dest = packet.cEMIMessage.dstAddress.toString()
					const src = packet.cEMIMessage.srcAddress.toString()
					const data = npdu.dataValue

					assert.equal(dest, '0/1/1')
					assert.equal(src, MockKNXServer.physicalAddress)

					if (npdu.isGroupRead || npdu.isGroupWrite) {
						const value = dptlib.resolve(dpt).fromBuffer(data)
						assert.equal(value, expectedValue)
						resolve()
					}
				})
			})
		}

		try {
            client = new KNXClient(
                {
                    loglevel: 'trace',
                    hostProtocol: 'TunnelUDP',
                    sniffingMode: true,
                },
                (c: KNXClient) => {
                    const server = new MockKNXServer(mockToggleResponses, c)
                    server.on('error', (error) => {
                        if (
                            !error.message.includes(
                                'No matching response found',
                            )
                        ) {
                            throw error
                        }
                    })
                    server.createFakeSocket()
                },
            )

			return await new Promise<void>((resolve, reject) => {
				client.on(KNXClientEvents.error, (error) => {
					reject(error)
				})

				client.on(KNXClientEvents.connected, async () => {
					try {
						// First toggle - ON
						client.write(groupId, true, dpt)
						// Advance by exact deltas from the mock
						await clock.tickAsync(9) // First response delta
						await clock.tickAsync(44) // Second response delta
						await clock.tickAsync(670) // Third response delta
						await waitForIndication(true)

						// Second toggle - OFF
						client.write(groupId, false, dpt)
						await clock.tickAsync(7) // First response delta
						await clock.tickAsync(43) // Second response delta
						await clock.tickAsync(563) // Third response delta
						await waitForIndication(false)

						await client.Disconnect()
						resolve()
					} catch (error) {
						reject(error)
					}
				})

				client.Connect()
				// Initial connection timing
				clock.tickAsync(9) // Connect response
				clock.tickAsync(20) // First heartbeat response
			})
		} finally {
			clock.restore()
		}
	})

    test('should handle long network disconnection leading to auto-disconnect', async () => {
		const clock = sinon.useFakeTimers({
			shouldAdvanceTime: true,
			toFake: [
				'setTimeout',
				'clearTimeout',
				'setInterval',
				'clearInterval',
				'Date',
			],
		})

		try {
			const events: string[] = []
			let server: MockKNXServer
			let disconnectReason = ''

			// Store original constants
			const originalStateTimeout =
				KNX_CONSTANTS.CONNECTIONSTATE_REQUEST_TIMEOUT
			const originalAliveTime = KNX_CONSTANTS.CONNECTION_ALIVE_TIME

			// Override timeouts for test
			KNX_CONSTANTS.CONNECTIONSTATE_REQUEST_TIMEOUT = 0.1 // 100ms instead of 10s
			KNX_CONSTANTS.CONNECTION_ALIVE_TIME = 0.1 // 100ms instead of 60s

            const client = new KNXClient(
                {
                    loglevel: 'trace',
                    hostProtocol: 'TunnelUDP',
                    ipAddr: MockKNXServer.host,
                    ipPort: MockKNXServer.port,
                    connectionKeepAliveTimeout: 0.1, // This needs to match CONNECTION_ALIVE_TIME
                    localIPAddress: getDefaultIpLocal(),
                },
                (c: KNXClient) => {
                    server = new MockKNXServer(
                        getMockPacketsForDisconnectTest,
                        c,
                    )
					server.on('error', (error) => {
						if (
							error.message.includes('No matching response found')
						) {
							throw new Error(
								`MockKNXServer error: ${error.message}`,
							)
						}
					})

					server.createFakeSocket()
				},
			)

			// Track connection
			const connectionPromise = new Promise<void>((resolve) => {
				client.once(KNXClientEvents.connected, () => {
					events.push('connected')
					resolve()
				})
			})

			// Track disconnection
			const disconnectionPromise = new Promise<void>((resolve) => {
				client.on(KNXClientEvents.error, (error) => {
					events.push('error')
				})

				client.once(KNXClientEvents.disconnected, (reason) => {
					disconnectReason = reason
					events.push('disconnected')
					resolve()
				})
			})

			try {
				// Connect and wait for connection
				client.Connect()
				await clock.tickAsync(10) // Wait for connection
				await connectionPromise

				// Initial state verification
				assert.strictEqual(
					client.isConnected(),
					true,
					'Should be connected initially',
				)
				assert.deepStrictEqual(
					events,
					['connected'],
					'Should have connected event',
				)
				assert.strictEqual(
					client['_heartbeatFailures'],
					0,
					'Should have no heartbeat failures',
				)

				// Wait for first successful heartbeat
				await clock.tickAsync(20)

				assert.strictEqual(
					client.isConnected(),
					true,
					'Should still be connected after first heartbeat',
				)
				assert.strictEqual(
					client['_heartbeatFailures'],
					0,
					'Should still have no failures',
				)

				// Simulate disconnection
				server.setPaused(true)

				// Wait for three heartbeat failures
				await clock.tickAsync(200) // First failure
				await clock.tickAsync(200) // Second failure
				await clock.tickAsync(200) // Third failure

				await disconnectionPromise

				// Final state verification
				assert.strictEqual(
					client['_heartbeatFailures'],
					0,
					'Heartbeat failures should reset after disconnection',
				)
				assert.strictEqual(
					client.isConnected(),
					false,
					'Should be disconnected',
				)
				assert.ok(
					disconnectReason.includes('Connection dead'),
					`Should disconnect due to dead connection, got: ${disconnectReason}`,
				)
				assert.deepStrictEqual(
					events,
					['connected', 'error', 'disconnected'],
					'Events should occur in correct order',
				)
			} finally {
				// Restore original constants
				KNX_CONSTANTS.CONNECTIONSTATE_REQUEST_TIMEOUT =
					originalStateTimeout
				KNX_CONSTANTS.CONNECTION_ALIVE_TIME = originalAliveTime

				if (client.isConnected()) {
					await client.Disconnect()
				}
			}
		} finally {
			clock.restore()
		}
	})

    test('should send a disconnect request', async () => {
		const events: string[] = []
		let server: MockKNXServer
		let disconnectReason = ''

        const client = new KNXClient(
            {
                loglevel: 'trace',
                hostProtocol: 'TunnelUDP',
                ipAddr: MockKNXServer.host,
                ipPort: MockKNXServer.port,
                localIPAddress: getDefaultIpLocal(),
            },
            (c: KNXClient) => {
                server = new MockKNXServer(
                    getMockPacketsForDisconnectRequestTest,
                    c,
                )
				server.on('error', (error) => {
					if (error.message.includes('No matching response found')) {
						throw new Error(`MockKNXServer error: ${error.message}`)
					}
				})

				server.createFakeSocket()
			},
		)

		// Track connection
		const connectionPromise = new Promise<void>((resolve) => {
			client.once(KNXClientEvents.connected, () => {
				events.push('connected')
				resolve()
			})
		})

		// Track disconnection
		const disconnectionPromise = new Promise<void>((resolve) => {
			client.on(KNXClientEvents.error, (error) => {
				events.push('error')
			})

			client.once(KNXClientEvents.disconnected, (reason) => {
				disconnectReason = reason
				events.push('disconnected')
				resolve()
			})
		})

		// Connect and wait for connection
		client.Connect()
		await connectionPromise

		// Connected state verification
		assert.strictEqual(client.isConnected(), true, 'Should be connected')
		assert.deepStrictEqual(
			events,
			['connected'],
			'Should have connected event',
		)

		// Disconnect and wait for disconnection
		client.Disconnect()

		await disconnectionPromise

		assert.strictEqual(
			client.isConnected(),
			false,
			'Should be disconnected',
		)

		assert.ok(
			disconnectReason.includes(
				'Received DISCONNECT_RESPONSE from the KNX interface',
			),
			`Should receive disconnect response: ${disconnectReason}`,
		)
	})
})
