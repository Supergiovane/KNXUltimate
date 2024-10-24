import { KNXClient, KNXClientEvents } from '../src'

if (process.argv.length < 3) {
	console.log('usage: %s <ga> <optional: status_ga> to toggle a light on & off',
		process.argv[1]);
	process.exit(1);
}

const groupAddress = process.argv[2]

let client: KNXClient

// Helper function to print sniffed packets
function printSniffedPackets(client: KNXClient) {
    const packets = client.getSniffingBuffers()
    if (packets.length === 0) return

    console.log('\nSniffed KNX packets:')
    packets.forEach((packet, index) => {
        console.log(`\nPacket ${index + 1}:`)
        console.log(`  Request:  ${packet.request}`)
        console.log(`  Response: ${packet.response || 'No response'}`)
        console.log(`  Time since last request: ${packet.deltaReq}ms`)
        if (packet.deltaRes !== undefined) {
            console.log(`  Response time: ${packet.deltaRes}ms`)
        }
    })
    
    // Clear the buffer after printing
    client.clearSniffingBuffers()
}

async function initClient() {
	const interfaces = await KNXClient.discover(1000)

	if(interfaces.length === 0) {
		console.log('No interfaces found')
		return
	}
	console.log('Discovered interfaces:', interfaces)

	const [ip, port] = interfaces[0].split(':')

	console.log('Connecting to', ip, port)

	client = new KNXClient({
		ipAddr: ip,
		ipPort: port,
		loglevel: 'trace',
		suppress_ack_ldatareq: false,
		hostProtocol: 'TunnelUDP',
        sniffingMode: true
	})
	
	client.on(KNXClientEvents.connected, info => {
		// The client is connected
		console.log('Connected. On Duty', info)
		onConnect()
	})

    // Add indication handler to print sniffed packets after each telegram
    client.on(KNXClientEvents.indication, () => {
        printSniffedPackets(client)
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
                printSniffedPackets(client)
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