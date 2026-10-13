/**
 * KNX Secure hardening: Data Secure receive checks (default and
 * strictSecurity), groupKeys option, requireDeviceAuthentication,
 * SESSION_STATUS handling, TCP stream validation and plain TCP tunnelling.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, it, before, after, afterEach } from 'node:test'
import assert from 'assert'
import fs from 'fs'
import net from 'net'
import os from 'os'
import path from 'path'
import KNXClient, {
	KNXClientEvents,
	KNXClientOptions,
} from '../../src/KNXClient'
import CEMIConstants from '../../src/protocol/cEMI/CEMIConstants'
import { Keyring } from '../../src/secure/keyring'
import { deriveDeviceAuthenticationPassword } from '../../src/secure/security_primitives'
import { MockSecureGateway } from './MockSecureGateway'
import signKeyringXml from './signKeyring'

const MANUAL = {
	knxkeys_file_path: undefined,
	knxkeys_password: undefined,
	tunnelUserPassword: 'anyPassword',
	tunnelUserId: 5,
}

const KEYRING_XML = `<?xml version="1.0" encoding="utf-8"?>
<Keyring CreatedBy="UnitTest" Created="2024-10-03T12:34:56Z">
  <Interface Type="Tunnelling" IndividualAddress="1.1.1" UserID="5" Password="9b1seR1kYPayZxTITA4mq3oRNSdkelNCOnHA0jtZK6g=" Authentication="6/b5wvUrvyg4J+JH+J3EPvaGbIug0amjx5PMHkztZUQ=">
    <Group Address="1/2/3" Senders="1.1.1 1.1.10" />
  </Interface>
  <GroupAddresses>
    <Group Address="1/2/3" Key="DFZA8HL9wnFWS3LGw40k/w==" />
  </GroupAddresses>
</Keyring>`

const GROUP_KEY = Buffer.from('00112233445566778899aabbccddeeff', 'hex')
const GA = '1/2/3'

const delay = (ms: number) =>
	new Promise<void>((r) => {
		setTimeout(r, ms)
	})

describe('KNX Secure hardening', () => {
	let tmpDir: string
	let keyringPath: string
	let gateway: MockSecureGateway | undefined
	let client: KNXClient | undefined
	let plainServer: net.Server | undefined
	let deviceAuthCode: Buffer

	before(async () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knx-secure-hard-'))
		keyringPath = path.join(tmpDir, 'test.knxkeys')
		fs.writeFileSync(
			keyringPath,
			await signKeyringXml(KEYRING_XML, 'knxPassword'),
			'utf8',
		)
		const kr = new Keyring()
		await kr.load(keyringPath, 'knxPassword')
		deviceAuthCode = deriveDeviceAuthenticationPassword(
			kr.getInterface('1.1.1')!.decryptedAuthentication!,
		)
	})

	after(() => {
		try {
			fs.rmSync(tmpDir, { recursive: true, force: true })
		} catch {}
	})

	afterEach(async () => {
		if (client) {
			try {
				await client.Disconnect()
			} catch {}
			client = undefined
		}
		if (gateway) {
			try {
				await gateway.stop()
			} catch {}
			gateway = undefined
		}
		if (plainServer) {
			await new Promise<void>((r) => {
				plainServer!.close(() => r())
			})
			plainServer = undefined
		}
	})

	type SetupOptions = {
		secure?: Partial<NonNullable<KNXClientOptions['secureTunnelConfig']>>
		gatewayIa?: string
		waitConnected?: boolean
		gatewayDeviceAuthCode?: Buffer
		truncateSessionResponse?: boolean
	}

	async function setup(opts: SetupOptions = {}) {
		const usesKeyring =
			opts.secure?.knxkeys_file_path !== undefined ||
			!('knxkeys_file_path' in (opts.secure ?? {}))
		const gw = new MockSecureGateway({
			deviceAuthCode:
				opts.gatewayDeviceAuthCode ??
				(usesKeyring ? deviceAuthCode : undefined),
			truncateSessionResponse: opts.truncateSessionResponse,
			groupKeys: { [GA]: GROUP_KEY },
			interfaceIndividualAddress: opts.gatewayIa ?? '1.1.1',
			tunnelAssignedIndividualAddress: '10.15.251',
			serial: Buffer.from('010203040506', 'hex'),
		})
		await gw.start()
		const addr = gw.address!
		const cli = new KNXClient({
			hostProtocol: 'TunnelTCP',
			ipAddr: '127.0.0.1',
			ipPort: addr.port,
			isSecureKNXEnabled: true,
			secureTunnelConfig: {
				knxkeys_file_path: keyringPath,
				knxkeys_password: 'knxPassword',
				tunnelInterfaceIndividualAddress: '1.1.1',
				...opts.secure,
			},
			loglevel: 'disable',
		})
		gateway = gw
		client = cli
		if (opts.waitConnected !== false) {
			const connected = new Promise<void>((resolve) => {
				cli.once(KNXClientEvents.connected, () => resolve())
			})
			cli.Connect()
			await connected
		}
		return { gw, cli }
	}

	function collectIndications(cli: KNXClient): boolean[] {
		const out: boolean[] = []
		cli.on('indication', (packet: any, echoed: boolean) => {
			if (echoed) return
			const cemi = packet?.cEMIMessage
			if (cemi?.msgCode !== CEMIConstants.L_DATA_IND) return
			if (cemi.dstAddress?.toString?.() !== GA) return
			out.push(((cemi.npdu?.dataValue?.[0] ?? 0) & 0x01) === 1)
		})
		return out
	}

	function waitFor<T>(
		register: (done: (v: T) => void) => void,
		timeoutMs: number,
		fallback: T,
	): Promise<T> {
		return new Promise<T>((resolve) => {
			const t = setTimeout(() => resolve(fallback), timeoutMs)
			register((v) => {
				clearTimeout(t)
				resolve(v)
			})
		})
	}

	it('delivers plain telegrams on a keyed group address by default', async () => {
		const { gw, cli } = await setup()
		const indications = collectIndications(cli)
		gw.writeRaw(gw.wrapInner(gw.buildPlainGroupWriteInner(GA, true)))
		await delay(250)
		assert.deepStrictEqual(indications, [true])
	})

	it('drops plain telegrams on a keyed group address with strictSecurity', async () => {
		const { gw, cli } = await setup({ secure: { strictSecurity: true } })
		const indications = collectIndications(cli)
		gw.writeRaw(gw.wrapInner(gw.buildPlainGroupWriteInner(GA, true)))
		await delay(200)
		assert.deepStrictEqual(indications, [])
		await gw.sendGroupValueWriteSecure(GA, false)
		await delay(200)
		assert.deepStrictEqual(indications, [false])
	})

	it('drops Data Secure telegrams from senders not in the keyring with strictSecurity', async () => {
		const { gw, cli } = await setup({
			secure: { strictSecurity: true },
			gatewayIa: '1.1.7',
		})
		const indications = collectIndications(cli)
		await gw.sendGroupValueWriteSecure(GA, true)
		await delay(250)
		assert.deepStrictEqual(indications, [])
	})

	it('accepts Data Secure telegrams from senders not in the keyring by default', async () => {
		const { gw, cli } = await setup({ gatewayIa: '1.1.7' })
		const indications = collectIndications(cli)
		await gw.sendGroupValueWriteSecure(GA, true)
		await delay(250)
		assert.deepStrictEqual(indications, [true])
	})

	it('drops a truncated Data Secure telegram instead of delivering it', async () => {
		const { gw, cli } = await setup()
		const indications = collectIndications(cli)
		// Keep TPCI/APCI + SCF + 4 bytes of sequence: too short to authenticate
		const valid = gw.buildSecureGroupWriteInner(GA, true).inner
		const truncated = Buffer.from(valid.subarray(0, 26))
		truncated.writeUInt16BE(truncated.length, 4)
		truncated[18] = 6
		gw.writeRaw(gw.wrapInner(truncated))
		await delay(250)
		assert.deepStrictEqual(indications, [])
		await gw.sendGroupValueWriteSecure(GA, true)
		await delay(250)
		assert.deepStrictEqual(indications, [true])
	})

	it('decrypts Data Secure with secureTunnelConfig.groupKeys and no keyring', async () => {
		const { gw, cli } = await setup({
			secure: {
				knxkeys_file_path: undefined,
				knxkeys_password: undefined,
				tunnelUserPassword: 'anyPassword',
				tunnelUserId: 5,
				groupKeys: { [GA]: GROUP_KEY.toString('hex') },
			},
		})
		const indications = collectIndications(cli)
		await gw.sendGroupValueWriteSecure(GA, true)
		await delay(250)
		assert.deepStrictEqual(indications, [true])
	})

	it('rejects an invalid groupKeys entry', async () => {
		const { cli } = await setup({
			secure: { groupKeys: { [GA]: 'abcd' } },
			waitConnected: false,
		})
		const result = await waitFor<string>(
			(done) => {
				cli.once(KNXClientEvents.connected, () => done('connected'))
				cli.once(KNXClientEvents.error, (e) => done(e.message))
				cli.Connect()
			},
			2000,
			'timeout',
		)
		assert.match(result, /groupKeys/)
	})

	it('refuses to connect without a device authentication code when requireDeviceAuthentication is set', async () => {
		const { cli } = await setup({
			secure: {
				knxkeys_file_path: undefined,
				knxkeys_password: undefined,
				tunnelUserPassword: 'anyPassword',
				tunnelUserId: 5,
				requireDeviceAuthentication: true,
			},
			waitConnected: false,
		})
		const result = await waitFor<string>(
			(done) => {
				cli.once(KNXClientEvents.connected, () => done('connected'))
				cli.once(KNXClientEvents.error, (e) => done(e.message))
				cli.Connect()
			},
			2000,
			'timeout',
		)
		assert.match(result, /requireDeviceAuthentication/)
	})

	it('disconnects when the gateway sends SESSION_STATUS CLOSE', async () => {
		const { gw, cli } = await setup()
		const disconnected = waitFor<boolean>(
			(done) => cli.once(KNXClientEvents.disconnected, () => done(true)),
			1500,
			false,
		)
		gw.sendSessionStatus(0x05)
		assert.strictEqual(await disconnected, true)
	})

	it('sends SESSION_STATUS CLOSE when disconnecting', async () => {
		const { gw, cli } = await setup()
		const status = waitFor<number>(
			(done) => gw.once('sessionStatus', (s) => done(s)),
			3000,
			-1,
		)
		await cli.Disconnect()
		client = undefined
		assert.strictEqual(await status, 0x05)
	})

	it('closes the connection on an invalid KNX/IP header instead of wedging', async () => {
		const { gw, cli } = await setup()
		const disconnected = waitFor<boolean>(
			(done) => cli.once(KNXClientEvents.disconnected, () => done(true)),
			1500,
			false,
		)
		cli.on(KNXClientEvents.error, () => {})
		gw.writeRaw(Buffer.from('061004200000', 'hex')) // length 0
		assert.strictEqual(await disconnected, true)
	})

	it('tunnels over plain TCP when KNX Secure is disabled', async () => {
		const received: number[] = []
		plainServer = net.createServer((socket) => {
			socket.on('data', (data) => {
				const type = data.readUInt16BE(2)
				received.push(type)
				if (type === 0x0205) {
					// CONNECT_RESPONSE: channel 7, OK, TCP HPAI, CRD IA 1.1.200
					socket.write(
						Buffer.from(
							'06100206001407000802000000000000040411c8',
							'hex',
						),
					)
				}
			})
		})
		await new Promise<void>((r) => {
			plainServer!.listen(0, '127.0.0.1', () => r())
		})
		const port = (plainServer.address() as net.AddressInfo).port
		const cli = new KNXClient({
			hostProtocol: 'TunnelTCP',
			ipAddr: '127.0.0.1',
			ipPort: port,
			isSecureKNXEnabled: false,
			loglevel: 'disable',
		})
		client = cli
		const connected = await waitFor<boolean>(
			(done) => {
				cli.once(KNXClientEvents.connected, () => done(true))
				cli.Connect()
			},
			3000,
			false,
		)
		assert.strictEqual(connected, true)
		assert.deepStrictEqual(received, [0x0205])
		assert.strictEqual(cli['_channelID'], 7)
	})

	it('sends no TUNNELLING_ACK over TCP and keeps identical telegrams', async () => {
		const { gw, cli } = await setup()
		const indications = collectIndications(cli)
		let acks = 0
		gw.on('tunnelAck', () => {
			acks += 1
		})
		// Same tunnel sequence and bytes twice: over TCP both are delivered
		const plain = gw.buildPlainGroupWriteInner(GA, true)
		gw.writeRaw(gw.wrapInner(plain))
		gw.writeRaw(gw.wrapInner(plain))
		await delay(250)
		assert.deepStrictEqual(indications, [true, true])
		assert.strictEqual(acks, 0)
	})

	it('drops a SecureWrapper carrying another session id', async () => {
		const { gw, cli } = await setup()
		const indications = collectIndications(cli)
		const { inner } = gw.buildSecureGroupWriteInner(GA, true)
		gw.writeRaw(gw.wrapInnerWithSessionId(inner, 0x1234))
		await delay(200)
		assert.deepStrictEqual(indications, [])
		await gw.sendGroupValueWriteSecure(GA, false)
		await delay(200)
		assert.deepStrictEqual(indications, [false])
	})

	it('skips a frame with an unsupported KNX/IP version and keeps the session', async () => {
		const { gw, cli } = await setup()
		const indications = collectIndications(cli)
		let disconnected = false
		cli.on(KNXClientEvents.disconnected, () => {
			disconnected = true
		})
		gw.writeRaw(Buffer.from('062004200008aabb', 'hex'))
		await gw.sendGroupValueWriteSecure(GA, true)
		await delay(250)
		assert.strictEqual(disconnected, false)
		assert.deepStrictEqual(indications, [true])
	})

	it('fails the handshake on a SESSION_RESPONSE without MAC', async () => {
		const { cli } = await setup({
			secure: MANUAL,
			truncateSessionResponse: true,
			waitConnected: false,
		})
		const result = await waitFor<string>(
			(done) => {
				cli.once(KNXClientEvents.connected, () => done('connected'))
				cli.once(KNXClientEvents.error, (e) => done(e.message))
				cli.Connect()
			},
			3000,
			'timeout',
		)
		assert.match(result, /Invalid SESSION_RESPONSE length/)
	})

	for (const [label, gatewayCode, clientCode] of [
		['with significant spaces', ' code ', ' code '],
		['entered with extra spaces', 'code', ' code '],
	]) {
		it(`verifies a manual device authentication code ${label}`, async () => {
			const { cli } = await setup({
				secure: { ...MANUAL, deviceAuthenticationPassword: clientCode },
				gatewayDeviceAuthCode:
					deriveDeviceAuthenticationPassword(gatewayCode),
				waitConnected: false,
			})
			const result = await waitFor<string>(
				(done) => {
					cli.once(KNXClientEvents.connected, () => done('connected'))
					cli.once(KNXClientEvents.error, (e) => done(e.message))
					cli.Connect()
				},
				3000,
				'timeout',
			)
			assert.strictEqual(result, 'connected')
		})
	}

	it('accepts secure tunnel frames only once the handshake is complete', async () => {
		const { gw, cli } = await setup()
		const indications = collectIndications(cli)
		cli['_secureHandshakeState'] = 'auth'
		await gw.sendGroupValueWriteSecure(GA, true)
		await delay(200)
		assert.deepStrictEqual(indications, [])
		cli['_secureHandshakeState'] = 'connected'
		await gw.sendGroupValueWriteSecure(GA, false)
		await delay(200)
		assert.deepStrictEqual(indications, [false])
	})

	it('forgets the previous session key when a new handshake starts', async () => {
		const { gw, cli } = await setup()
		const indications = collectIndications(cli)
		const oldWrapper = gw.wrapInner(gw.buildPlainGroupWriteInner(GA, true))
		await cli['secureStartSession']()
		assert.strictEqual(cli['_secureSessionKey'], undefined)
		assert.strictEqual(cli['_secureSessionId'], undefined)
		gw.writeRaw(oldWrapper)
		await delay(200)
		assert.deepStrictEqual(indications, [])
	})

	it('completes Disconnect() on the gateway DISCONNECT_RESPONSE', async () => {
		const { cli } = await setup()
		const reason = waitFor<string>(
			(done) => cli.once(KNXClientEvents.disconnected, (r) => done(r)),
			3000,
			'timeout',
		)
		const start = Date.now()
		await cli.Disconnect()
		client = undefined
		assert.match(await reason, /Received DISCONNECT_RESPONSE/)
		assert.ok(Date.now() - start < 1000)
	})

	it('uses its own serial number in outgoing wrappers, not the gateway one', async () => {
		const { gw, cli } = await setup()
		const serials: string[] = []
		const original = gw['handleSecureWrapper'].bind(gw)
		gw['handleSecureWrapper'] = (frame: Buffer) => {
			serials.push(frame.subarray(14, 20).toString('hex'))
			return original(frame)
		}
		cli.write(GA, true, '1.001')
		await delay(200)
		assert.ok(serials.length > 0)
		for (const serial of serials) {
			assert.strictEqual(serial, '00006b6e7875')
		}
	})
})
