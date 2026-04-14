/**
 * Unit tests for KNXIPTunnelServer (UDP).
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'
import * as dgram from 'node:dgram'
import { KNXIPTunnelServer, KNXProtocol } from '../../src'
import { KNX_CONSTANTS } from '../../src/protocol/KNXConstants'
import HPAI, { KnxProtocol as HPAIProtocol } from '../../src/protocol/HPAI'
import TunnelCRI from '../../src/protocol/TunnelCRI'
import KNXAddress from '../../src/protocol/KNXAddress'
import KNXDataBuffer from '../../src/protocol/KNXDataBuffer'
import CEMIFactory from '../../src/protocol/cEMI/CEMIFactory'
import CEMIConstants from '../../src/protocol/cEMI/CEMIConstants'

process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'warn'

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const t = setTimeout(() => reject(new Error(label)), ms)
		p.then(
			(v) => {
				clearTimeout(t)
				resolve(v)
			},
			(e) => {
				clearTimeout(t)
				reject(e)
			},
		)
	})
}

function onceMessage(sock: dgram.Socket): Promise<Buffer> {
	return new Promise((resolve) => {
		sock.once('message', (msg) => resolve(msg))
	})
}

describe('KNXIPTunnelServer', () => {
	it('should accept CONNECT_REQUEST and forward tunneling telegrams as ROUTING_INDICATION', async () => {
		const server = new KNXIPTunnelServer({
			listenHost: '127.0.0.1',
			listenPort: 0,
			advertiseHost: '127.0.0.1',
			assignedIndividualAddress: '1.1.250',
			maxSessions: 1,
			loglevel: 'warn',
		})
		const client = dgram.createSocket('udp4')
		try {
			await server.start()
			const addr = server.address
			assert.ok(addr, 'server address is missing')

			await new Promise<void>((resolve) => {
				client.bind(0, '127.0.0.1', () => resolve())
			})
			const clientAddr = client.address() as dgram.AddressInfo

			const hpai = new HPAI(
				'127.0.0.1',
				clientAddr.port,
				HPAIProtocol.IPV4_UDP,
			)
			const cri = new TunnelCRI(KNX_CONSTANTS.TUNNEL_LINKLAYER)
			const connectReq = KNXProtocol.newKNXConnectRequest(cri, hpai, hpai)

			const connectRespP = withTimeout(
				onceMessage(client),
				1000,
				'timeout CONNECT_RESPONSE',
			)
			client.send(connectReq.toBuffer(), addr.port, addr.host)
			const connectRespBuf = await connectRespP

			const parsedConnect = KNXProtocol.parseMessage(connectRespBuf)
			assert.strictEqual(
				parsedConnect.knxHeader.service_type,
				KNX_CONSTANTS.CONNECT_RESPONSE,
			)
			const connectResp = parsedConnect.knxMessage as any
			assert.strictEqual(connectResp.status, 0)
			const channelId = connectResp.channelID as number
			assert.ok(channelId > 0)

			let busFrameOut: Buffer | null = null
			let rawTelegram: any = null
			server.once('busFrameOut', (frame) => {
				busFrameOut = frame
			})
			server.once('rawTelegram', (t) => {
				rawTelegram = t
			})

			const src = KNXAddress.createFromString(
				'1.1.1',
				KNXAddress.TYPE_INDIVIDUAL,
			)
			const dst = KNXAddress.createFromString(
				'1/1/1',
				KNXAddress.TYPE_GROUP,
			)
			const data = new KNXDataBuffer(Buffer.from([0x01]))
			const cemi = CEMIFactory.newLDataRequestMessage(
				'write',
				src,
				dst,
				data,
			)

			const tunnReq = KNXProtocol.newKNXTunnelingRequest(
				channelId,
				1,
				cemi,
			)
			const ackP = withTimeout(
				onceMessage(client),
				1000,
				'timeout TUNNELING_ACK',
			)
			client.send(tunnReq.toBuffer(), addr.port, addr.host)
			const ackBuf = await ackP

			const parsedAck = KNXProtocol.parseMessage(ackBuf)
			assert.strictEqual(
				parsedAck.knxHeader.service_type,
				KNX_CONSTANTS.TUNNELING_ACK,
			)
			const ack = parsedAck.knxMessage as any
			assert.strictEqual(ack.channelID, channelId)
			assert.strictEqual(ack.seqCounter, 1)

			await withTimeout(
				new Promise<void>((resolve, reject) => {
					const start = Date.now()
					const check = () => {
						if (busFrameOut) {
							resolve()
							return
						}
						if (Date.now() - start > 1000) {
							reject(new Error('timeout busFrameOut'))
							return
						}
						setTimeout(check, 10)
					}
					check()
				}),
				1200,
				'timeout busFrameOut wait',
			)

			const parsedBus = KNXProtocol.parseMessage(busFrameOut!)
			assert.strictEqual(
				parsedBus.knxHeader.service_type,
				KNX_CONSTANTS.ROUTING_INDICATION,
			)
			const routing = parsedBus.knxMessage as any
			assert.strictEqual(
				routing.cEMIMessage.msgCode,
				CEMIConstants.L_DATA_IND,
			)
			// Server should override source IA for routing injection
			assert.strictEqual(
				routing.cEMIMessage.srcAddress.toString(),
				'1.1.250',
			)

			assert.ok(rawTelegram, 'rawTelegram missing')
			assert.strictEqual(rawTelegram.event, 'GroupValue_Write')
			assert.strictEqual(rawTelegram.source, '1.1.250')
			assert.strictEqual(rawTelegram.destination, '1/1/1')
			assert.ok(Buffer.isBuffer(rawTelegram.apdu.data))
			assert.strictEqual(rawTelegram.apdu.bitlength, 6)
			assert.ok(!('echoed' in rawTelegram))
		} finally {
			try {
				client.close()
			} catch {}
			await server.stop()
		}
	})

	it('should inject ROUTING_INDICATION into tunneling sessions as TUNNELING_REQUEST', async () => {
		const server = new KNXIPTunnelServer({
			listenHost: '127.0.0.1',
			listenPort: 0,
			advertiseHost: '127.0.0.1',
			assignedIndividualAddress: '1.1.250',
			maxSessions: 1,
			loglevel: 'warn',
		})
		const client = dgram.createSocket('udp4')
		try {
			await server.start()
			const addr = server.address
			assert.ok(addr, 'server address is missing')

			await new Promise<void>((resolve) => {
				client.bind(0, '127.0.0.1', () => resolve())
			})
			const clientAddr = client.address() as dgram.AddressInfo

			const hpai = new HPAI(
				'127.0.0.1',
				clientAddr.port,
				HPAIProtocol.IPV4_UDP,
			)
			const cri = new TunnelCRI(KNX_CONSTANTS.TUNNEL_LINKLAYER)
			const connectReq = KNXProtocol.newKNXConnectRequest(cri, hpai, hpai)

			const connectRespP = withTimeout(
				onceMessage(client),
				1000,
				'timeout CONNECT_RESPONSE',
			)
			client.send(connectReq.toBuffer(), addr.port, addr.host)
			const connectRespBuf = await connectRespP
			const parsedConnect = KNXProtocol.parseMessage(connectRespBuf)
			const connectResp = parsedConnect.knxMessage as any
			const channelId = connectResp.channelID as number

			const src = KNXAddress.createFromString(
				'1.1.10',
				KNXAddress.TYPE_INDIVIDUAL,
			)
			const dst = KNXAddress.createFromString(
				'1/1/2',
				KNXAddress.TYPE_GROUP,
			)
			const data = new KNXDataBuffer(Buffer.from([0x00]))
			const cemiInd = CEMIFactory.newLDataIndicationMessage(
				'write',
				src,
				dst,
				data,
			)
			const routing = KNXProtocol.newKNXRoutingIndication(cemiInd)

			const tunReqP = withTimeout(
				onceMessage(client),
				1000,
				'timeout server TUNNELING_REQUEST',
			)
			server.injectBusFrame(routing.toBuffer())
			const tunBuf = await tunReqP

			const parsedTun = KNXProtocol.parseMessage(tunBuf)
			assert.strictEqual(
				parsedTun.knxHeader.service_type,
				KNX_CONSTANTS.TUNNELING_REQUEST,
			)
			const tun = parsedTun.knxMessage as any
			assert.strictEqual(tun.channelID, channelId)
			assert.strictEqual(
				tun.cEMIMessage.msgCode,
				CEMIConstants.L_DATA_IND,
			)
		} finally {
			try {
				client.close()
			} catch {}
			await server.stop()
		}
	})
})
