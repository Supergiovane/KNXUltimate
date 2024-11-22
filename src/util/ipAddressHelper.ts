import { hasProp } from '../utils'
import { module } from '../KnxLog'
import os, { NetworkInterfaceInfo } from 'os'

const logger = module('ipAddressHelper')

export function getIPv4Interfaces(): { [key: string]: NetworkInterfaceInfo } {
	const candidateInterfaces: { [key: string]: NetworkInterfaceInfo } = {}
	let interfaces: Record<string, NetworkInterfaceInfo[]> =
		os.networkInterfaces()

	if (process.env.CI) {
		// create a fake interface for CI
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
	}

	for (const iface in interfaces) {
		for (const intf of interfaces[iface]) {
			try {
				logger.debug('parsing interface: %s (%j)', iface, intf)
				if (
					intf.family !== undefined &&
					(intf.family.toString().includes('4') ||
						(intf as any).family === 4) &&
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
	if (_interface !== '') {
		if (!hasProp(candidateInterfaces, _interface)) {
			logger.error(
				`exports.getLocalAddress: Interface ${_interface} not found or has no useful IPv4 address!`,
			)
			throw Error(
				`Interface ${_interface} not found or has no useful IPv4 address!`,
			)
		} else {
			return candidateInterfaces[_interface].address
		}
	}

	if (Object.keys(candidateInterfaces).length > 0) {
		return candidateInterfaces[Object.keys(candidateInterfaces)[0]].address
	}

	throw Error('No valid IPv4 interfaces detected')
}
