/**
 * Minimal sample showing how to connect via a TP/FT1.2 serial interface.
 */

import KNXClient, { KNXClientEvents } from '../src/KNXClient'

async function main() {
	const ports = await KNXClient.listSerialInterfaces()
	console.log('Available serial ports:', ports)

	const path = ports[0]?.path ?? '/dev/ttyAMA0'

	const client = new KNXClient({
		hostProtocol: 'SerialFT12',
		serialInterface: { path },
		physAddr: '1.1.200',
		loglevel: 'info',
	})

	client.on(KNXClientEvents.connected, () => {
		console.log(`✓ Connected to ${path}`)
	})

	client.on(KNXClientEvents.indication, (packet) => {
		const cemi = packet?.cEMIMessage
		const src = cemi?.srcAddress?.toString?.()
		const dst = cemi?.dstAddress?.toString?.()
		console.log('Telegram:', { src, dst })
	})

	client.on(KNXClientEvents.error, (err) => {
		console.error('Serial FT1.2 error:', err.message)
	})

	client.Connect()
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
