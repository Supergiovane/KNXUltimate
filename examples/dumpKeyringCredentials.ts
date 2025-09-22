import path from 'path'
import { Keyring } from '../src/secure/keyring'

async function main() {
	const [fileArg, passwordArg] = process.argv.slice(2)
	const defaultKeyring = path.resolve(
		__dirname,
		'../documents/Secure Test.knxkeys',
	)
	const file = fileArg || defaultKeyring
	const password = passwordArg || 'passwordprogetto'

	const kr = new Keyring()
	await kr.load(file, password)

	console.log(`Loaded keyring: ${file}`)
	console.log(`Created by: ${kr.getCreatedBy() || 'unknown'}`)
	console.log(`Created at: ${kr.getCreated() || 'unknown'}`)

	console.log('\n=== Secure tunnelling interfaces ===')
	for (const [key, iface] of kr.getInterfaces()) {
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
		const keyBytes = entry.decryptedKey?.toString('hex') || '(empty)'
		console.log(`GA ${ga} key=${keyBytes}`)
	}

	console.log('\n=== Backbone Keys ===')
	for (const backbone of kr.getBackbones()) {
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
