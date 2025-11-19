import KNXClient, { KNXClientEvents } from '../src/KNXClient'

let client: KNXClient | null = null

async function main() {
	const path = '/dev/cu.usbserial-0001'

	client = new KNXClient({
		hostProtocol: 'SerialFT12',
		serialInterface: {
			path,
			baudRate: 19200,
			dataBits: 8,
			stopBits: 1,
			parity: 'even',
			isKBERRY: true,
			lock: false,
		},
		physAddr: '15.15.255',
		loglevel: 'debug',
	})

	client.on(KNXClientEvents.connecting, () => {
		console.log(`Connecting to ${path}…`)
	})

	client.on(KNXClientEvents.connected, () => {
		console.log(`✓ Listening on ${path}`)
		try {
			setTimeout(() => {client.write('0/1/26', true, '1.001')			
				console.log('→ Sent true to 0/1/26')	
			}, 5000)
			
		} catch (error) {
			console.error('Failed to write 0/1/26:', (error as Error).message)
		}
	})

	client.on(KNXClientEvents.indication, (packet) => {
		const cemi = packet?.cEMIMessage
		const src = cemi?.srcAddress?.toString?.() ?? 'unknown'
		const dst = cemi?.dstAddress?.toString?.() ?? 'unknown'
		console.log(`[${new Date().toISOString()}] ${src} -> ${dst}`)
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

process.on('SIGINT', () => {
	console.log('Closing KNX client…')
	if (client) client.Disconnect()
	setTimeout(() => process.exit(0), 300)
})
