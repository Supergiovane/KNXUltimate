/**
 * Unit tests for ipAddressHelper.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import os, { NetworkInterfaceInfo } from 'node:os'
import sinon from 'sinon'
import {
	getIPv4Interfaces,
	getLocalAddress,
} from '../../src/util/ipAddressHelper'

const FAKE_IP = '192.168.1.58'

describe('ipAddressHelper', () => {
	describe('multiple addresses per interface', () => {
		let origFakeIface: string | undefined
		let interfaces: sinon.SinonStub

		const ipv4 = (address: string): NetworkInterfaceInfo => ({
			address,
			netmask: '255.255.255.0',
			family: 'IPv4',
			mac: '00:00:00:00:00:00',
			internal: false,
			cidr: `${address}/24`,
		})
		const primary = ipv4('192.168.178.252')
		const vip = ipv4('192.168.178.254')

		beforeEach(() => {
			origFakeIface = process.env.KNX_USE_FAKE_IFACE
			delete process.env.KNX_USE_FAKE_IFACE
			interfaces = sinon.stub(os, 'networkInterfaces')
		})

		afterEach(() => {
			interfaces.restore()
			if (origFakeIface === undefined)
				delete process.env.KNX_USE_FAKE_IFACE
			else process.env.KNX_USE_FAKE_IFACE = origFakeIface
		})

		test('keeps the first IPv4 and its metadata for each interface', () => {
			const wifi = ipv4('10.0.0.2')
			interfaces.returns({
				eth0: [primary, vip],
				wlan0: [wifi, ipv4('10.0.0.3')],
			})

			assert.deepEqual(getIPv4Interfaces(), {
				eth0: primary,
				wlan0: wifi,
			})
			assert.equal(getLocalAddress('eth0'), primary.address)
			assert.equal(getLocalAddress('wlan0'), wifi.address)
			assert.equal(getLocalAddress(), primary.address)
		})

		test('skips IPv6 and internal addresses before selecting the first usable IPv4', () => {
			interfaces.returns({
				eth0: [
					{
						...primary,
						address: 'fe80::1',
						family: 'IPv6',
						netmask: 'ffff:ffff:ffff:ffff::',
						cidr: 'fe80::1/64',
						scopeid: 1,
					},
					{ ...ipv4('127.0.0.1'), internal: true },
					primary,
					vip,
				],
				lo: [{ ...ipv4('127.0.0.1'), internal: true }],
			})

			assert.deepEqual(getIPv4Interfaces(), { eth0: primary })
		})

		test('keeps the first IPv4 when Node.js reports numeric address families', () => {
			const numericPrimary = { ...primary, family: 4 }
			interfaces.returns({
				eth0: [numericPrimary, { ...vip, family: 4 }],
			})

			assert.deepEqual(getIPv4Interfaces(), { eth0: numericPrimary })
		})

		test('preserves automatic preference for physical interfaces over virtual ones', () => {
			interfaces.returns({
				docker0: [ipv4('172.17.0.1')],
				eth0: [primary, vip],
			})

			assert.equal(getLocalAddress(), primary.address)
			assert.equal(getLocalAddress('docker0'), '172.17.0.1')
		})
	})

	describe('getIPv4Interfaces (CI fake interface)', () => {
		let origCI: string | undefined
		let origFakeIface: string | undefined

		beforeEach(() => {
			origCI = process.env.CI
			origFakeIface = process.env.KNX_USE_FAKE_IFACE
			process.env.CI = '1'
			process.env.KNX_USE_FAKE_IFACE = '1'
		})

		afterEach(() => {
			if (origCI === undefined) delete process.env.CI
			else process.env.CI = origCI
			if (origFakeIface === undefined)
				delete process.env.KNX_USE_FAKE_IFACE
			else process.env.KNX_USE_FAKE_IFACE = origFakeIface
		})

		test('returns exactly one interface named eth0', () => {
			const ifaces = getIPv4Interfaces()
			assert.ok('eth0' in ifaces)
			assert.equal(Object.keys(ifaces).length, 1)
		})

		test('eth0 has the expected IP address', () => {
			const ifaces = getIPv4Interfaces()
			assert.equal(ifaces.eth0.address, FAKE_IP)
		})

		test('eth0 is not marked as internal', () => {
			const ifaces = getIPv4Interfaces()
			assert.equal(ifaces.eth0.internal, false)
		})

		test('eth0 is IPv4', () => {
			const ifaces = getIPv4Interfaces()
			assert.equal(ifaces.eth0.family, 'IPv4')
		})
	})

	describe('getLocalAddress (CI fake interface)', () => {
		let origCI: string | undefined
		let origFakeIface: string | undefined

		beforeEach(() => {
			origCI = process.env.CI
			origFakeIface = process.env.KNX_USE_FAKE_IFACE
			process.env.CI = '1'
			process.env.KNX_USE_FAKE_IFACE = '1'
		})

		afterEach(() => {
			if (origCI === undefined) delete process.env.CI
			else process.env.CI = origCI
			if (origFakeIface === undefined)
				delete process.env.KNX_USE_FAKE_IFACE
			else process.env.KNX_USE_FAKE_IFACE = origFakeIface
		})

		test('auto-selects the fake interface IP when no name given', () => {
			assert.equal(getLocalAddress(), FAKE_IP)
		})

		test('returns correct IP when interface name is specified explicitly', () => {
			assert.equal(getLocalAddress('eth0'), FAKE_IP)
		})

		test('throws for an unknown interface name', () => {
			assert.throws(
				() => getLocalAddress('nonexistent0'),
				/Interface nonexistent0 not found or has no useful IPv4 address/,
			)
		})
	})

	describe('getLocalAddress (real OS interfaces)', () => {
		test('returns a valid IPv4 address string from the real OS', () => {
			const ip = getLocalAddress()
			assert.match(
				ip,
				/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
				'expected a dotted-decimal IPv4 address',
			)
		})
	})
})
