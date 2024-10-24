import { test, describe } from 'node:test'
import assert from 'node:assert'
import { dptlib, KNXClient, KNXClientEvents, SnifferPacket } from '../../src'
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

const getMockToggleResponses = (): SnifferPacket[] => {
	const localIp = getDefaultIpLocal()
	const knxGwIp = ipToHex(MockKNXServer.host)

	if (!localIp) {
		throw new Error('No local IP found')
	}

	return [
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

	test('should perform toggle operation', { timeout: 10000 }, async () => {
		const groupId = '0/0/1'
		const dpt = '1.001'

		const client = new KNXClient(
			{
				loglevel: 'trace',
				hostProtocol: 'TunnelUDP',
				sniffingMode: true,
			},
			(c: KNXClient) => {
				const server = new MockKNXServer(getMockToggleResponses(), c)
				server.createFakeSocket()
			},
		)

		function waitForIndication(expectedValue: any) {
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

		return new Promise<void>((resolve, reject) => {
			client.on(KNXClientEvents.error, (error) => {
				reject(error)
			})

			client.on(KNXClientEvents.connected, async () => {
				try {
					// First toggle - ON
					client.write(groupId, true, dpt)

					await waitForIndication(true)

					// Second toggle - OFF

					client.write(groupId, false, dpt)

					await waitForIndication(false)

					await client.Disconnect()
					resolve()
				} catch (error) {
					reject(error)
				}
			})

			client.Connect()
		})
	})
})
