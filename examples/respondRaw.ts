/**
 * Example demonstrating KNXClient.respondRaw().
 *
 * respondRaw(dstAddress, rawDataBuffer, bitlength)
 * - rawDataBuffer: the raw APDU payload bytes you want to send
 * - bitlength: payload length in bits (<= 6 means "6-bit payload", encoded in APCI low bits)
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import KNXClient, { KNXClientEvents, KNXClientOptions } from '../src/KNXClient'
import { populateAPDU, APDU } from '../src/dptlib'
import { wait } from '../src/utils'

// Plain multicast configuration (router). Change to TunnelUDP/TunnelTCP as needed.
const options: KNXClientOptions = {
	ipAddr: '224.0.23.12',
	ipPort: 3671,
	hostProtocol: 'Multicast',
	physAddr: '1.1.100',
	loglevel: 'info',
	suppress_ack_ldatareq: false,
	isSecureKNXEnabled: false,
}

function encodeWithDptLib(value: unknown, dptid: string | number): APDU {
	const apdu: APDU = { bitlength: 0, data: Buffer.alloc(0) }
	populateAPDU(value, apdu, dptid)
	return apdu
}

async function main() {
	const client = new KNXClient(options)

	client.on(KNXClientEvents.connected, async () => {
		console.log(
			'Connected. WARNING: this example will send RESPONSE telegrams on your KNX bus.',
		)

		// Example 1: 1-bit payload (DPT 1.xxx style).
		// IMPORTANT: keep bitlength <= 6 so the value is encoded into the APCI low bits.
		// Replace the GA with a real one from your ETS project.
		client.respondRaw('1/1/1', Buffer.from([0x01]), 1) // ON
		await wait(200)

		// Example 2: build the APDU using dptlib, then send it as raw bytes.
		// Replace the GA with a real one from your ETS project.
		const temperature = encodeWithDptLib(21.5, '9.001') // 2-byte float (°C)
		client.respondRaw('1/1/2', temperature.data, temperature.bitlength)
		await wait(200)

		client.Disconnect()
	})

	client.on(KNXClientEvents.error, (err) => {
		console.error('KNX error:', err)
	})

	client.on(KNXClientEvents.disconnected, (reason) => {
		console.log('Disconnected:', reason)
		process.exit(0)
	})

	client.Connect()
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})

