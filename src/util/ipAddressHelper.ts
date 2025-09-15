import { hasProp } from '../utils'
import { module } from '../KnxLog'
import os, { NetworkInterfaceInfo } from 'os'

const logger = module('ipAddressHelper')

export function getIPv4Interfaces(): { [key: string]: NetworkInterfaceInfo } {
	const candidateInterfaces: { [key: string]: NetworkInterfaceInfo } = {}
	let interfaces: Record<string, NetworkInterfaceInfo[]>

	// In CI (only when explicitly enabled), avoid touching real OS network and provide a deterministic interface
	if (process.env.CI && process.env.KNX_USE_FAKE_IFACE) {
		interfaces = {
			eth0: [
				{
					address: '192.168.1.58',
					netmask: '255.255.255.0',
					family: 'IPv4',
					mac: '00:00:00:00:00:00',
					internal: false,
					cidr: '192.168.1.58/24',
				},
			],
		}
	} else {
		try {
			interfaces = os.networkInterfaces()
		} catch (e) {
			logger.error(
				'getIPv4Interfaces: os.networkInterfaces failed: %s',
				(e as Error)?.message || e,
			)
			throw e
		}
	}
	for (const iface in interfaces) {
		for (let index = 0; index < interfaces[iface].length; index++) {
			let intf
			try {
				intf = interfaces[iface][index]
				if (intf === undefined) {
					logger.debug('intf is null: control point 1')
				} else {
					logger.debug('parsing interface: %s (%j)', iface, intf)
					if (
						intf.family !== undefined &&
						(intf.family.toString().includes('4') ||
							intf.family === 4) &&
						!intf.internal
					) {
						logger.debug(
							'Found suitable interface: %s (%j)',
							iface,
							intf,
						)
						candidateInterfaces[iface] = intf
					} else {
						logger.debug(
							'Found NOT suitable interface: %s (%j)',
							iface,
							intf,
						)
					}
				}
			} catch (error) {
				logger.error(
					'getIPv4Interfaces: error parsing the interface %s (%j)',
					iface,
					intf,
				)
			}
		}
	}
	return candidateInterfaces
}

export function getLocalAddress(_interface = ''): string {
	logger.debug('getLocalAddress: getting interfaces')

	const candidateInterfaces = getIPv4Interfaces()

	// 1) Explicit interface name takes precedence (no env usage)
	const requested = _interface || ''
	if (requested !== '') {
		if (!hasProp(candidateInterfaces, requested)) {
			logger.error(
				`exports.getLocalAddress: Interface ${requested} not found or has no useful IPv4 address!`,
			)
			throw Error(
				`Interface ${requested} not found or has no useful IPv4 address!`,
			)
		}
		return candidateInterfaces[requested].address
	}

	// 2) Heuristic selection: prefer physical LAN/Wi‑Fi over virtual/NAT
	const entries = Object.entries(candidateInterfaces)
	if (entries.length === 0) throw Error('No valid IPv4 interfaces detected')

	const isRfc1918 = (ip: string) => {
		return (
			ip.startsWith('10.') ||
			ip.startsWith('192.168.') ||
			(ip.startsWith('172.') &&
				(() => {
					const n = parseInt(ip.split('.')[1] || '0', 10)
					return n >= 16 && n <= 31
				})())
		)
	}

	const isApipa = (ip: string) => ip.startsWith('169.254.')

	const looksVirtual = (name: string) =>
		/(^|\b)(vnic|vmnet|utun|awdl|bridge|br-|vboxnet|docker|tap|zt|lo|gif|stf|ap|llw)/i.test(
			name,
		)

	const looksPhysical = (name: string) =>
		/^(en\d+|eth\d+|wlan\d+|wlx\w+)/i.test(name) ||
		/wi-?fi|ethernet/i.test(name)

	const score = (name: string, ip: string) => {
		let s = 0
		if (looksPhysical(name)) s += 100
		if (isRfc1918(ip)) s += 40
		// Prefer classic home LAN 192.168.x slightly over 10.x/172.16-31
		if (ip.startsWith('192.168.')) s += 20
		if (looksVirtual(name)) s -= 200
		if (isApipa(ip)) s -= 500
		return s
	}

	const best = entries
		.map(([name, info]) => ({ name, info, s: score(name, info.address) }))
		.sort((a, b) => b.s - a.s)[0]

	logger.debug(
		'Selected interface: %s (%j) with score %d',
		best.name,
		best.info,
		best.s,
	)

	return best.info.address
}
