import { KNXClient, KNXClientEvents } from '../src'

if (process.argv.length < 3) {
	console.log('usage: %s <ga> <optional: status_ga> to toggle a light on & off',
		process.argv[1]);
	process.exit(1);
}

const groupAddress = process.argv[2]

let client: KNXClient

function initClient() {
	client = new KNXClient({
		ipAddr: '192.168.1.116',
		// ipAddr: '224.0.23.12',
		ipPort: '3671',
		physAddr: '15.15.15',
		loglevel: 'trace',
		interface: 'wlp2s0',
		suppress_ack_ldatareq: false,
		localEchoInTunneling: true, // Leave true, forever.
		hostProtocol: 'TunnelUDP', // "Multicast" in case you use a KNX/IP Router, "TunnelUDP" in case of KNX/IP Interface, "TunnelTCP" in case of secure KNX/IP Interface (not yet implemented)
		//isSecureKNXEnabled: false, // Leave "false" until KNX-Secure has been released
		//jKNXSecureKeyring: "", // ETS Keyring JSON file (leave blank until KNX-Secure has been released)
		localIPAddress: '' // Leave blank, will be automatically filled by KNXUltimate
	})
	
	client.on(KNXClientEvents.connected, info => {
		// The client is connected
		console.log('Connected. On Duty', info)
		onConnect()
	})

	client.Connect()
}

function onConnect() {
	console.log('----------')
	console.log('Connected!')
	console.log('----------')

	// Now send off a couple of requests:
	console.log('\n\n\n')
	console.log('PRESS ANY KEY TO TOGGLE %s AND "q" TO QUIT.', process.argv[2])
	console.log('\n\n\n')
	let dpVal = false
	process.stdin.setRawMode(true)
	process.stdin.resume()
	process.stdin.on('data', async (data) => {
		console.log(JSON.stringify(data))
		if (data[0] === 113) {
			if (client && client?.isConnected()) {
				await client.Disconnect()
				client = null
				console.log('\n\n\n')

				console.log('PRESS ANY KEY TO RECONNECT AND "q" TO QUIT')
				return
			} else {
				process.exit(0)
			}
		}

		if(!client) {
			initClient()
			return
		}
		dpVal = !dpVal
		console.log('Sending ' + dpVal, 'to', groupAddress)
		client.write(groupAddress, dpVal, '1.001')
	})
}

initClient()
