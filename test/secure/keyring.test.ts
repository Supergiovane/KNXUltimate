/**
 * Tests loading and using KNX Secure keyring files.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, it } from 'node:test'
import assert from 'assert'
import { Keyring } from '../../src/secure/keyring'

const password = 'knxPassword'
const created = '2024-10-03T12:34:56Z'

const ifacePasswordEnc = '9b1seR1kYPayZxTITA4mq3oRNSdkelNCOnHA0jtZK6g='
const ifaceAuthEnc = '6/b5wvUrvyg4J+JH+J3EPvaGbIug0amjx5PMHkztZUQ='
const mgmtPasswordEnc = 'pijNuGYx6LA+7ZJ4vyWtUMTfuPFXEIEL5A8lmHadX6A='
const deviceAuthEnc = 'dMWy3GlA8iHV7cflIRyp7S0dBxyEiHFTWIE7qdMh6u4='
const groupKeyEnc = 'DFZA8HL9wnFWS3LGw40k/w=='
const backboneKeyEnc = 'XvI24ir4JEE0cxRMsMKtbw=='
const toolKeyEnc = 'dxJwaArmxpY3eftE9Qzj3Q=='

const keyringXml = `<?xml version="1.0" encoding="utf-8"?>
<Keyring CreatedBy="UnitTest" Created="${created}">
  <Interface Type="Tunnelling" IndividualAddress="1.1.1" UserID="5" Password="${ifacePasswordEnc}" Authentication="${ifaceAuthEnc}">
    <Group Address="1/2/3" Senders="1.1.1 1.1.10" />
  </Interface>
  <Backbone Key="${backboneKeyEnc}" Latency="20" MulticastAddress="224.0.23.12" />
  <GroupAddresses>
    <Group Address="1/2/3" Key="${groupKeyEnc}" />
  </GroupAddresses>
  <Devices>
    <Device IndividualAddress="1.1.10" ToolKey="${toolKeyEnc}" ManagementPassword="${mgmtPasswordEnc}" Authentication="${deviceAuthEnc}" SequenceNumber="42" SerialNumber="12345678" />
  </Devices>
</Keyring>`

describe('secure keyring', () => {
	it('loads and decrypts interfaces, group addresses, devices, and backbone entries', async () => {
		const keyring = new Keyring()
		await keyring.loadFromString(keyringXml, password)

		assert.strictEqual(keyring.getCreatedBy(), 'UnitTest')
		assert.strictEqual(keyring.getCreated(), created)

		const iface = keyring.getInterface('1.1.1')
		assert.ok(iface)
		assert.strictEqual(iface?.decryptedPassword, 'ifPass123')
		assert.strictEqual(iface?.decryptedAuthentication, 'ifAuth456')
		const senders = iface?.groupAddresses.get('1/2/3') || []
		assert.deepStrictEqual(
			senders.map((sender) => sender.toString()),
			['1.1.1', '1.1.10'],
		)

		const backbones = keyring.getBackbones()
		assert.strictEqual(backbones.length, 1)
		assert.strictEqual(
			backbones[0].decryptedKey?.toString('hex'),
			'8899aabbccddeeff0011223344556677',
		)

		const group = keyring.getGroupAddress('1/2/3')
		assert.ok(group)
		assert.strictEqual(
			group?.decryptedKey?.toString('hex'),
			'00112233445566778899aabbccddeeff',
		)

		const device = keyring.getDevice('1.1.10')
		assert.ok(device)
		assert.strictEqual(device?.decryptedToolKey?.toString('hex'), 'aabbccddeeff00112233445566778899')
		assert.strictEqual(device?.decryptedManagementPassword, 'devMgmt789')
		assert.strictEqual(device?.decryptedAuthentication, 'devAuth987')
		assert.strictEqual(device?.sequenceNumber, 42)
		assert.strictEqual(device?.serialNumber, '12345678')
	})
})
