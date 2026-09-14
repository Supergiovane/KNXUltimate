import assert from 'node:assert/strict'
import dgram from 'node:dgram'
import os, { NetworkInterfaceInfo } from 'node:os'
import { afterEach, beforeEach, describe, it } from 'node:test'
import sinon from 'sinon'

import KNXClient, { KNXClientOptions } from '../../src/KNXClient'

const PRIMARY_IP = '192.168.1.252'
const VIRTUAL_IP = '192.168.1.254'

const interfaceInfo = (address: string): NetworkInterfaceInfo => ({
	address,
	netmask: '255.255.255.0',
	family: 'IPv4',
	mac: '00:11:22:33:44:55',
	internal: false,
	cidr: `${address}/24`,
})

describe('KNXClient local address selection', () => {
	let originalFakeInterface: string | undefined
	let networkInterfaces: sinon.SinonStub
	let socket: sinon.SinonStubbedInstance<dgram.Socket>

	beforeEach(() => {
		originalFakeInterface = process.env.KNX_USE_FAKE_IFACE
		delete process.env.KNX_USE_FAKE_IFACE
		networkInterfaces = sinon.stub(os, 'networkInterfaces').returns({
			eth0: [interfaceInfo(PRIMARY_IP), interfaceInfo(VIRTUAL_IP)],
		})
		socket = sinon.createStubInstance(dgram.Socket)
		sinon.stub(dgram, 'createSocket').returns(socket)
	})

	afterEach(() => {
		sinon.restore()
		if (originalFakeInterface === undefined) {
			delete process.env.KNX_USE_FAKE_IFACE
		} else {
			process.env.KNX_USE_FAKE_IFACE = originalFakeInterface
		}
	})

	const createClient = (options: KNXClientOptions = {}) =>
		new KNXClient({
			hostProtocol: 'TunnelUDP',
			ipAddr: '192.0.2.1',
			loglevel: 'disable',
			...options,
		})

	const assertBoundTo = (address: string) => {
		sinon.assert.calledOnce(socket.bind)
		assert.deepEqual(socket.bind.firstCall.args[0], { address })
	}

	it('automatically binds to the first IPv4 address instead of a later VIP', () => {
		createClient()
		assertBoundTo(PRIMARY_IP)
	})

	it('binds to the first IPv4 address of an explicitly selected interface', () => {
		createClient({ interface: 'eth0' })
		assertBoundTo(PRIMARY_IP)
	})

	const addressOrders = [
		[PRIMARY_IP, VIRTUAL_IP],
		[VIRTUAL_IP, PRIMARY_IP],
	]
	addressOrders.forEach((addresses) => {
		it(`preserves an explicit local IP when interface addresses are ${addresses.join(', ')}`, () => {
			networkInterfaces.returns({ eth0: addresses.map(interfaceInfo) })
			createClient({ localIPAddress: PRIMARY_IP })
			assertBoundTo(PRIMARY_IP)
			sinon.assert.notCalled(networkInterfaces)
		})
	})

	it('allows explicitly binding to the secondary VIP', () => {
		createClient({ localIPAddress: VIRTUAL_IP })
		assertBoundTo(VIRTUAL_IP)
		sinon.assert.notCalled(networkInterfaces)
	})

	it('gives an explicit local IP precedence over the interface option', () => {
		createClient({ localIPAddress: PRIMARY_IP, interface: 'missing0' })
		assertBoundTo(PRIMARY_IP)
		sinon.assert.notCalled(networkInterfaces)
	})

	it('uses an explicit local IP even when interface enumeration is unavailable', () => {
		networkInterfaces.throws(new Error('network interfaces unavailable'))
		createClient({ localIPAddress: PRIMARY_IP })
		assertBoundTo(PRIMARY_IP)
		sinon.assert.notCalled(networkInterfaces)
	})

	const emptyAddresses = ['', undefined]
	emptyAddresses.forEach((localIPAddress) => {
		it(`falls back to interface selection when localIPAddress is ${JSON.stringify(localIPAddress)}`, () => {
			createClient({ localIPAddress, interface: 'eth0' })
			assertBoundTo(PRIMARY_IP)
			sinon.assert.calledOnce(networkInterfaces)
		})
	})
})
