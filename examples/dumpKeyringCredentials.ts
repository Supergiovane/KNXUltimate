/**
 * Example dumping credentials from a KNX keyring file.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import path from 'path'
import { Keyring } from '../src/secure/keyring'

async function main() {
	const [fileArg, passwordArg] = process.argv.slice(2)
	// Fall back to the sample assets if no CLI args are provided
	const defaultKeyring = path.resolve(
		__dirname,
		'../documents/Secure Test.knxkeys',
	)
	const file = fileArg || defaultKeyring
	const password = passwordArg || 'passwordprogetto'

	const kr = new Keyring()
	// Load and decrypt the ETS keyring content
	await kr.load(file, password)

	console.log(`Loaded keyring: ${file}`)
	console.log(`Created by: ${kr.getCreatedBy() || 'unknown'}`)
	console.log(`Created at: ${kr.getCreated() || 'unknown'}`)

	console.log('\n=== Secure tunnelling interfaces ===')
	for (const [key, iface] of kr.getInterfaces()) {
		// Each interface holds tunnel credentials and optional group key references
		const ia = iface.individualAddress?.toString?.() || key
		console.log(`Interface IA ${ia}`)
		console.log(
			`  userId=${iface.userId ?? 'n/a'} password=${
				iface.decryptedPassword || '(empty)'
			}`,
		)
		if (iface.decryptedAuthentication) {
			console.log(`  authCode=${iface.decryptedAuthentication}`)
		}
		if (iface.groupAddresses?.size) {
			console.log(
				`  group addresses: ${Array.from(iface.groupAddresses.keys()).join(', ')}`,
			)
		}
	}

	console.log('\n=== Devices ===')
	for (const [ia, device] of kr.getDevices()) {
		// Device entries expose per-interface management credentials
		console.log(`Device ${ia}`)
		if (device.decryptedManagementPassword) {
			console.log(`  managementPassword=${device.decryptedManagementPassword}`)
		}
		if (device.decryptedAuthentication) {
			console.log(`  authenticationCode=${device.decryptedAuthentication}`)
		}
		if (device.decryptedToolKey) {
			console.log(`  toolKey=${device.decryptedToolKey.toString('hex')}`)
		}
	}

	console.log('\n=== Group Address Keys ===')
	for (const [ga, entry] of kr.getGroupAddresses()) {
		// Group keys are required for KNX Data Secure telegrams
		const keyBytes = entry.decryptedKey?.toString('hex') || '(empty)'
		console.log(`GA ${ga} key=${keyBytes}`)
	}

	console.log('\n=== Backbone Keys ===')
	for (const backbone of kr.getBackbones()) {
		// Backbone keys secure routing domains; print multicast + latency for reference
		const keyHex = backbone.decryptedKey?.toString('hex') || '(empty)'
		console.log(
			`Backbone multicast=${backbone.multicastAddress || 'n/a'} latency=${
				backbone.latency ?? 'n/a'
			} key=${keyHex}`,
		)
	}

	console.log('\nDump complete.')
}

main().catch((err) => {
	console.error('Failed to dump keyring credentials:', err)
	process.exit(1)
})
