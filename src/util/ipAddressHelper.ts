import { hasProp } from '../utils'
import KnxLog from '../KnxLog'
import os, { NetworkInterfaceInfo } from 'os'

export function getIPv4Interfaces(): { [key: string]: NetworkInterfaceInfo } {
	const candidateInterfaces: { [key: string]: NetworkInterfaceInfo } = {}
	const interfaces = os.networkInterfaces()
	for (const iface in interfaces) {
		for (const key in interfaces[iface]) {
			const intf = interfaces[iface][key]
			try {
				KnxLog.get().debug(
					'ipAddressHelper.js: parsing interface: %s (%j)',
					iface,
					intf,
				)
				if (
					intf.family !== undefined &&
					(intf.family.toString().includes('4') ||
						(intf as any).family === 4) &&
					!intf.internal
				) {
					KnxLog.get().trace(
						'ipAddressHelper.js: Found suitable interface: %s (%j)',
						iface,
						intf,
					)
					candidateInterfaces[iface] = intf
				} else {
					KnxLog.get().trace(
						'ipAddressHelper.js: Found NOT suitable interface: %s (%j)',
						iface,
						intf,
					)
				}
			} catch (error) {
				KnxLog.get().error(
					'ipAddressHelper.js: getIPv4Interfaces: error parsing the interface %s (%j)',
					iface,
					intf,
				)
			}
		}
	}

	return candidateInterfaces
}

export function getLocalAddress(_interface = ''): string {
	KnxLog.get().trace(
		'ipAddressHelper.js: getLocalAddress: getting interfaces',
	)
	const candidateInterfaces = getIPv4Interfaces()
	if (_interface !== '') {
		if (!hasProp(candidateInterfaces, _interface)) {
			KnxLog.get().error(
				`ipAddressHelper.js: exports.getLocalAddress: Interface ${_interface} not found or has no useful IPv4 address!`,
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
