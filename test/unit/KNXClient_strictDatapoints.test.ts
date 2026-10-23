/**
 * Unit tests for the strictDatapoints option: KNXClient forwards it to the
 * dptlib encoder, and the legacy encoding is kept when it is off.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { Socket as UDPSocket } from 'node:dgram'
import sinon from 'sinon'

import KNXClient, { KNXClientOptions } from '../../src/KNXClient'

describe('KNXClient strictDatapoints', () => {
	afterEach(() => {
		sinon.restore()
	})

	function createClient(options: Partial<KNXClientOptions> = {}) {
		const socket = sinon.createStubInstance(UDPSocket)
		return new KNXClient(
			{
				hostProtocol: 'TunnelUDP',
				ipAddr: '192.0.2.1',
				localIPAddress: '192.0.2.2',
				physAddr: '1.0.39',
				loglevel: 'disable',
				...options,
			},
			(instance) => {
				instance['_clientSocket'] = socket
			},
		)
	}

	const encode = (client: KNXClient, value: any, dpt: string) =>
		client['getKNXDataBuffer'](value, dpt).value.toString('hex')

	it('keeps the legacy encoding by default', () => {
		const client = createClient()
		assert.equal(encode(client, 128, '5.001'), '80')
		assert.equal(encode(client, 300, '20.102'), '2c')
	})

	it('throws for out-of-range values when enabled', () => {
		const client = createClient({ strictDatapoints: true })
		assert.throws(() => encode(client, 128, '5.001'), /out of range/)
		assert.throws(() => encode(client, 300, '20.102'))
		assert.equal(encode(client, 100, '5.001'), 'ff')
	})
})
