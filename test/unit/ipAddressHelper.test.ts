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
import {
	getIPv4Interfaces,
	getLocalAddress,
} from '../../src/util/ipAddressHelper'

const FAKE_IP = '192.168.1.58'

describe('ipAddressHelper', () => {
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
			if (origFakeIface === undefined) delete process.env.KNX_USE_FAKE_IFACE
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
			if (origFakeIface === undefined) delete process.env.KNX_USE_FAKE_IFACE
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
