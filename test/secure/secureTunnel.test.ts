/**
 * Tests the KNX Secure tunnelling client workflows.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'assert'
import fs from 'fs'
import os from 'os'
import path from 'path'
import KNXClient, {
	KNXClientEvents,
	type SecureConfig,
} from '../../src/KNXClient'
import CEMIConstants from '../../src/protocol/cEMI/CEMIConstants'
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

describe('KNX Secure Tunnel', () => {
	let tmpDir: string
	let keyringPath: string
	let keyringBuffer: Buffer

	before(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knx-secure-'))
		keyringPath = path.join(tmpDir, 'test.knxkeys')
		fs.writeFileSync(keyringPath, KEYRING_XML, 'utf8')
		keyringBuffer = fs.readFileSync(keyringPath)
	})

	after(() => {
		try {
			fs.rmSync(tmpDir, { recursive: true, force: true })
		} catch {}
	})

	it('handshakes and exchanges Data Secure telegrams (keyring file path)', async () => {
		await runSecureTunnelScenario({
			knxkeys_file_path: keyringPath,
			knxkeys_password: 'knxPassword',
			tunnelInterfaceIndividualAddress: '1.1.1',
		})
	})

	it('handshakes and exchanges Data Secure telegrams (keyring buffer)', async () => {
		await runSecureTunnelScenario({
			knxkeys_buffer: keyringBuffer,
			knxkeys_password: 'knxPassword',
			tunnelInterfaceIndividualAddress: '1.1.1',
		})
	})
})

async function runSecureTunnelScenario(secureTunnelConfig: SecureConfig) {
	const gateway = new MockSecureGateway({
		groupKeys: {
			'1/2/3': Buffer.from('00112233445566778899aabbccddeeff', 'hex'),
		},
		interfaceIndividualAddress: '1.1.1',
		tunnelAssignedIndividualAddress: '10.15.251',
		serial: Buffer.from('010203040506', 'hex'),
	})
	await gateway.start()

	const address = gateway.address
	assert.ok(address, 'gateway should expose address')

	const client = new KNXClient({
		hostProtocol: 'TunnelTCP',
		ipAddr: address!.address === '::' ? '127.0.0.1' : address!.address,
		ipPort: address!.port,
		isSecureKNXEnabled: true,
		secureTunnelConfig,
		loglevel: 'error',
	})

	const connected = onceEvent(client, KNXClientEvents.connected)
	client.Connect()
	await connected

	const groupWriteReceived = new Promise<void>((resolve, reject) => {
		const timeout = setTimeout(
			() => reject(new Error('Timeout waiting server group write')),
			5000,
		)
		gateway.once('groupWrite', (packet) => {
			try {
				assert.strictEqual(packet.groupAddress, '1/2/3')
				assert.strictEqual(packet.value, true)
				clearTimeout(timeout)
				resolve()
			} catch (err) {
				reject(err)
			}
		})
	})

	client.write('1/2/3', true, '1.001')
	await groupWriteReceived

	const indication = new Promise<boolean>((resolve, reject) => {
		const timeout = setTimeout(
			() => reject(new Error('Timeout waiting for indication')),
			5000,
		)
		const handler = (packet: any) => {
			try {
				const cemi = packet?.cEMIMessage
				if (cemi?.msgCode !== CEMIConstants.L_DATA_IND) return
				if (cemi.dstAddress?.toString?.() !== '1/2/3') return
				const value = (cemi.npdu?.dataValue?.[0] ?? 0) & 0x01
				client.off('indication', handler)
				clearTimeout(timeout)
				resolve(value === 1)
			} catch (err) {
				reject(err)
			}
		}
		client.on('indication', handler)
	})

	try {
		await gateway.sendGroupValueWriteSecure('1/2/3', false)
		const receivedValue = await indication
		assert.strictEqual(receivedValue, false)
	} finally {
		try {
			await client.Disconnect()
		} catch {}
		await gateway.stop()
	}
}

function onceEvent(client: KNXClient, event: KNXClientEvents): Promise<void> {
	return new Promise((resolve) => {
		client.once(event, () => resolve())
	})
}
