/**
 * DESCRIPTION_REQUEST must announce the local UDP port the client listens on (#117).
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import dgram from 'node:dgram'

import KNXClient from '../../src/KNXClient'
import { KNX_CONSTANTS } from '../../src/protocol/KNXConstants'

describe('KNXClient DESCRIPTION_REQUEST', () => {
	it('announces the bound UDP port in the HPAI, also when sent right after the client is created', async () => {
		const server = dgram.createSocket('udp4')
		await new Promise<void>((resolve) => {
			server.bind(0, '127.0.0.1', () => resolve())
		})
		const request = new Promise<{ hpaiPort: number; sourcePort: number }>(
			(resolve) => {
				server.once('message', (msg, rinfo) => {
					assert.equal(
						msg.readUInt16BE(2),
						KNX_CONSTANTS.DESCRIPTION_REQUEST,
					)
					// Header (6 bytes), then HPAI: length, protocol, IP (4 bytes), port
					resolve({
						hpaiPort: msg.readUInt16BE(12),
						sourcePort: rinfo.port,
					})
				})
			},
		)

		const client = new KNXClient({
			ipAddr: '127.0.0.1',
			ipPort: server.address().port,
			localIPAddress: '127.0.0.1',
			hostProtocol: 'TunnelUDP',
		} as any)
		try {
			client.startGatewayDescription()
			const { hpaiPort, sourcePort } = await request
			assert.notEqual(hpaiPort, KNX_CONSTANTS.KNX_PORT)
			assert.equal(hpaiPort, sourcePort)
		} finally {
			client.stopGatewayDescription()
			await client.Disconnect()
			server.close()
		}
	})
})
