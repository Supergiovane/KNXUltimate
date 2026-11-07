/**
 * Tests the telegram outcome over a KNX IP Secure tunnel with Data Secure.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { afterEach, describe, it } from 'node:test'
import assert from 'assert'
import KNXClient, { KNXClientEvents } from '../../src/KNXClient'
import { ConfirmationError } from '../../src/errors'
import { MockSecureGateway } from './MockSecureGateway'

const GROUP_KEY = Buffer.from('00112233445566778899aabbccddeeff', 'hex')
const GA = '1/2/3'
const GA_WITHOUT_KEY = '1/2/4'

describe('KNX Secure telegram outcome', () => {
	let gateway: MockSecureGateway | undefined
	let client: KNXClient | undefined

	afterEach(async () => {
		try {
			await client?.Disconnect()
		} catch {}
		await gateway?.stop()
		client = undefined
		gateway = undefined
	})

	async function setup(
		lDataCon: MockSecureGateway['lDataCon'],
		lDataConUnwrapped = false,
	) {
		const gw = new MockSecureGateway({
			groupKeys: { [GA]: GROUP_KEY },
			interfaceIndividualAddress: '1.1.1',
			tunnelAssignedIndividualAddress: '10.15.251',
			serial: Buffer.from('010203040506', 'hex'),
		})
		gw.lDataCon = lDataCon
		gw.lDataConUnwrapped = lDataConUnwrapped
		await gw.start()
		const cli = new KNXClient({
			hostProtocol: 'TunnelTCP',
			ipAddr: '127.0.0.1',
			ipPort: gw.address!.port,
			isSecureKNXEnabled: true,
			secureTunnelConfig: {
				tunnelInterfaceIndividualAddress: '1.1.1',
				tunnelUserPassword: 'anyPassword',
				tunnelUserId: 5,
				groupKeys: { [GA]: GROUP_KEY.toString('hex') },
			},
			loglevel: 'disable',
		})
		gateway = gw
		client = cli
		const connected = new Promise<void>((resolve) => {
			cli.once(KNXClientEvents.connected, () => resolve())
		})
		cli.Connect()
		await connected
		return { gw, cli }
	}

	it('resolves on the L_Data.con of a Data Secure telegram', async () => {
		const { gw, cli } = await setup('positive')
		const decrypted = new Promise<boolean>((resolve) => {
			gw.once('groupWrite', (packet) => resolve(packet.value))
		})
		await cli.write(GA, true, '1.001')
		// The gateway could decrypt it, so what it confirmed was Data Secure
		assert.equal(await decrypted, true)
	})

	it('rejects on a negative L_Data.con of a Data Secure telegram', async () => {
		const { cli } = await setup('negative')
		await assert.rejects(cli.write(GA, true, '1.001'), ConfirmationError)
		assert.equal(cli.isConnected(), true)
	})

	it('does not accept an L_Data.con with another secured APDU', async () => {
		const { cli } = await setup('altered')
		let settled = false
		const outcome = cli.write(GA, true, '1.001')
		outcome
			.finally(() => {
				settled = true
			})
			.catch(() => {})
		await new Promise((resolve) => {
			setTimeout(resolve, 150)
		})
		assert.equal(settled, false)
		await cli.Disconnect()
		await assert.rejects(outcome, /Disconnected/)
	})

	it('accepts an L_Data.con outside the SecureWrapper, as Apricum sends it', async () => {
		const { cli } = await setup('positive', true)
		await cli.write(GA, true, '1.001')
		await cli.write(GA_WITHOUT_KEY, true, '1.001')
	})

	it('rejects on a negative L_Data.con outside the SecureWrapper', async () => {
		const { cli } = await setup('negative', true)
		await assert.rejects(cli.write(GA, true, '1.001'), ConfirmationError)
	})

	it('does not accept an unwrapped L_Data.con with another APDU', async () => {
		const { cli } = await setup('altered', true)
		let settled = false
		const outcome = cli.write(GA, true, '1.001')
		outcome
			.finally(() => {
				settled = true
			})
			.catch(() => {})
		await new Promise((resolve) => {
			setTimeout(resolve, 150)
		})
		assert.equal(settled, false)
		await cli.Disconnect()
		await assert.rejects(outcome, /Disconnected/)
	})

	it('stops accepting unwrapped frames once the server wrapped one', async () => {
		const { gw, cli } = await setup('positive')
		await cli.write(GA, true, '1.001')

		gw.lDataConUnwrapped = true
		let settled = false
		const outcome = cli.write(GA, false, '1.001')
		outcome
			.finally(() => {
				settled = true
			})
			.catch(() => {})
		await new Promise((resolve) => {
			setTimeout(resolve, 150)
		})
		assert.equal(settled, false)
		await cli.Disconnect()
		await assert.rejects(outcome, /Disconnected/)
	})

	it('ignores an unwrapped L_Data.con for another channel, and never emits it', async () => {
		const { gw, cli } = await setup('none')
		const indications: unknown[] = []
		cli.on(KNXClientEvents.indication, (packet, echoed) => {
			if (!echoed) indications.push(packet)
		})
		const inner: Buffer[] = []
		const original = gw['handleTunnelingRequest'].bind(gw)
		gw['handleTunnelingRequest'] = (frame: Buffer) => {
			original(frame)
			inner.push(frame)
		}
		let settled = false
		const outcome = cli.write(GA_WITHOUT_KEY, true, '1.001')
		outcome
			.finally(() => {
				settled = true
			})
			.catch(() => {})
		await new Promise((resolve) => {
			setTimeout(resolve, 100)
		})

		const con = Buffer.from(inner[0])
		con[10] = 0x2e
		con[7] ^= 0xff
		gw.writeRaw(con)
		await new Promise((resolve) => {
			setTimeout(resolve, 100)
		})
		assert.equal(settled, false)

		con[7] ^= 0xff
		gw.writeRaw(con)
		await outcome
		assert.deepEqual(indications, [])
	})

	it('resolves for a group address without Data Secure', async () => {
		const { cli } = await setup('positive')
		await cli.write(GA_WITHOUT_KEY, true, '1.001')
	})
})
