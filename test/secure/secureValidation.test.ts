/**
 * Tests that the KNX Secure receive path rejects forged, replayed and
 * tampered traffic (regression tests for the security hardening of the
 * unicast SecureWrapper, SESSION_RESPONSE and Data Secure paths).
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, it, before, after, afterEach } from 'node:test'
import assert from 'assert'
import fs from 'fs'
import os from 'os'
import path from 'path'
import KNXClient, { KNXClientEvents } from '../../src/KNXClient'
import CEMIConstants from '../../src/protocol/cEMI/CEMIConstants'
import { Keyring } from '../../src/secure/keyring'
import { deriveDeviceAuthenticationPassword } from '../../src/secure/security_primitives'
import { MockSecureGateway } from './MockSecureGateway'

const KEYRING_XML = `<?xml version="1.0" encoding="utf-8"?>
<Keyring CreatedBy="UnitTest" Created="2024-10-03T12:34:56Z">
  <Interface Type="Tunnelling" IndividualAddress="1.1.1" UserID="5" Password="9b1seR1kYPayZxTITA4mq3oRNSdkelNCOnHA0jtZK6g=" Authentication="6/b5wvUrvyg4J+JH+J3EPvaGbIug0amjx5PMHkztZUQ=">
    <Group Address="1/2/3" Senders="1.1.1 1.1.10" />
  </Interface>
  <Backbone Key="XvI24ir4JEE0cxRMsMKtbw==" Latency="20" MulticastAddress="224.0.23.12" />
  <GroupAddresses>
    <Group Address="1/2/3" Key="DFZA8HL9wnFWS3LGw40k/w==" />
  </GroupAddresses>
  <Devices>
    <Device IndividualAddress="1.1.10" ToolKey="dxJwaArmxpY3eftE9Qzj3Q==" ManagementPassword="pijNuGYx6LA+7ZJ4vyWtUMTfuPFXEIEL5A8lmHadX6A=" Authentication="dMWy3GlA8iHV7cflIRyp7S0dBxyEiHFTWIE7qdMh6u4=" SequenceNumber="42" SerialNumber="010203040506" />
  </Devices>
</Keyring>`

const GROUP_KEY = Buffer.from('00112233445566778899aabbccddeeff', 'hex')
const GA = '1/2/3'

const delay = (ms: number) =>
	new Promise<void>((r) => {
		setTimeout(r, ms)
	})

describe('KNX Secure validation (negative paths)', () => {
	let tmpDir: string
	let keyringPath: string
	let deviceAuthCode: Buffer

	let gateway: MockSecureGateway | undefined
	let client: KNXClient | undefined

	before(async () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knx-secure-neg-'))
		keyringPath = path.join(tmpDir, 'test.knxkeys')
		fs.writeFileSync(keyringPath, KEYRING_XML, 'utf8')
		const kr = new Keyring()
		await kr.load(keyringPath, 'knxPassword')
		const auth = kr.getInterface('1.1.1')?.decryptedAuthentication
		assert.ok(auth, 'keyring should expose interface authentication')
		deviceAuthCode = deriveDeviceAuthenticationPassword(auth!)
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
	})

	// Build a client + (already connected) gateway, unless connect is expected
	// to fail (waitConnected=false).
	async function setup(
		gatewayDeviceAuthCode: Buffer | undefined,
		waitConnected = true,
	): Promise<{ gw: MockSecureGateway; cli: KNXClient }> {
		const gw = new MockSecureGateway({
			groupKeys: { [GA]: GROUP_KEY },
			interfaceIndividualAddress: '1.1.1',
			tunnelAssignedIndividualAddress: '10.15.251',
			serial: Buffer.from('010203040506', 'hex'),
			deviceAuthCode: gatewayDeviceAuthCode,
		})
		await gw.start()
		const addr = gw.address!
		const cli = new KNXClient({
			hostProtocol: 'TunnelTCP',
			ipAddr: addr.address === '::' ? '127.0.0.1' : addr.address,
			ipPort: addr.port,
			isSecureKNXEnabled: true,
			secureTunnelConfig: {
				knxkeys_file_path: keyringPath,
				knxkeys_password: 'knxPassword',
				tunnelInterfaceIndividualAddress: '1.1.1',
			},
			loglevel: 'error',
		})
		gateway = gw
		client = cli
		if (waitConnected) {
			const connected = new Promise<void>((resolve) => {
				cli.once(KNXClientEvents.connected, () => resolve())
			})
			cli.Connect()
			await connected
		}
		return { gw, cli }
	}

	// Collects decoded GA=1/2/3 indications.
	function collectIndications(cli: KNXClient): boolean[] {
		const out: boolean[] = []
		cli.on('indication', (packet: any) => {
			const cemi = packet?.cEMIMessage
			if (cemi?.msgCode !== CEMIConstants.L_DATA_IND) return
			if (cemi.dstAddress?.toString?.() !== GA) return
			const value = (cemi.npdu?.dataValue?.[0] ?? 0) & 0x01
			out.push(value === 1)
		})
		return out
	}

	it('rejects a forged SESSION_RESPONSE with an invalid device-auth MAC', async () => {
		// Gateway signs the SESSION_RESPONSE with the WRONG device auth code.
		const wrongCode = Buffer.alloc(16, 0xab)
		const { cli } = await setup(wrongCode, false)

		const result = await new Promise<'connected' | 'error'>((resolve) => {
			const t = setTimeout(() => resolve('error'), 2500)
			cli.once(KNXClientEvents.connected, () => {
				clearTimeout(t)
				resolve('connected')
			})
			cli.once(KNXClientEvents.error, () => {
				clearTimeout(t)
				resolve('error')
			})
			cli.Connect()
		})

		assert.strictEqual(
			result,
			'error',
			'client must not connect on a forged SESSION_RESPONSE',
		)
	})

	it('drops a replayed SecureWrapper (identical bytes resent)', async () => {
		const { gw, cli } = await setup(deviceAuthCode)
		const indications = collectIndications(cli)

		const { inner } = gw.buildSecureGroupWriteInner(GA, true)
		const wrapper = gw.wrapInner(inner)
		gw.writeRaw(wrapper) // legitimate
		gw.writeRaw(wrapper) // replay: same wrapper sequence
		await delay(400)

		assert.strictEqual(
			indications.length,
			1,
			'replayed wrapper must be dropped (only one indication expected)',
		)
	})

	it('drops a SecureWrapper whose MAC has been tampered', async () => {
		const { gw, cli } = await setup(deviceAuthCode)
		const indications = collectIndications(cli)

		const { inner } = gw.buildSecureGroupWriteInner(GA, true)
		const wrapper = gw.wrapInner(inner)
		const tampered = Buffer.from(wrapper)
		tampered[tampered.length - 1] ^= 0xff // flip a MAC byte
		gw.writeRaw(tampered)
		await delay(300)
		assert.strictEqual(
			indications.length,
			0,
			'tampered wrapper must be dropped',
		)

		// A subsequent valid telegram is still processed (session survives).
		await gw.sendGroupValueWriteSecure(GA, true)
		await delay(300)
		assert.strictEqual(
			indications.length,
			1,
			'valid telegram after a tampered one must still be processed',
		)
	})

	it('drops a replayed Data Secure telegram (same seq in a fresh wrapper)', async () => {
		const { gw, cli } = await setup(deviceAuthCode)
		const indications = collectIndications(cli)

		// First telegram with sender sequence N.
		const first = gw.buildSecureGroupWriteInner(GA, true)
		gw.writeRaw(gw.wrapInner(first.inner))
		await delay(250)
		assert.strictEqual(indications.length, 1, 'first telegram accepted')

		// Replay the SAME Data Secure sequence inside a brand-new wrapper: the
		// wrapper freshness passes but Data Secure freshness must reject it.
		const replay = gw.buildSecureGroupWriteInner(GA, true, first.seq48)
		gw.writeRaw(gw.wrapInner(replay.inner))
		await delay(250)
		assert.strictEqual(
			indications.length,
			1,
			'replayed Data Secure telegram must be dropped',
		)
	})

	it('drops plaintext KNX/IP frames inside the secure session', async () => {
		const { gw, cli } = await setup(deviceAuthCode)
		const indications = collectIndications(cli)

		// Plaintext CONNECT_RESPONSE (06 10 02 06 | len=0x14 | ch status | HPAI | CRD)
		// injected unwrapped; total length field (0x0014 = 20) matches its bytes.
		const plainConnectResponse = Buffer.from(
			'061002060014510008017f0000010e5704040200',
			'hex',
		)
		assert.strictEqual(
			plainConnectResponse.length,
			0x14,
			'plaintext test frame length must match its header',
		)
		gw.writeRaw(plainConnectResponse)
		await delay(300)

		// Session must stay alive and still process a valid wrapped telegram.
		await gw.sendGroupValueWriteSecure(GA, true)
		await delay(300)
		assert.strictEqual(
			indications.length,
			1,
			'plaintext frame must be ignored but the session must keep working',
		)
	})
})
