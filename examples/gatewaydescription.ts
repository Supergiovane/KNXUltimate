// Get the gateway description of each gatewau found

import { setTimeout } from 'timers'
import { KNXClient, KNXClientEvents } from '../src'
import { KNX_CONSTANTS } from '../src/protocol/KNXConstants'

let client: KNXClient

async function initClient() {
	const knxGateways = await KNXClient.discover()

	if(knxGateways.length === 0) {
		console.log('No gateway found')
		return
	}
	console.log('Discovered gateways:', knxGateways)

	const [ip, port] = knxGateways[0].split(':') // For simplicity, takes only the first gateway found.

	console.log('Connecting to', ip, port)

	client = new KNXClient({
		ipAddr: ip,
		ipPort: port,
		loglevel: 'info',
		suppress_ack_ldatareq: false,
		hostProtocol: 'TunnelUDP'
	})
	
	client.on(KNXClientEvents.connected, info => {
		// The client is connected
		console.log('On Duty', info);
		console.log('----------');
        console.log('Connected!');
        console.log('----------');
		client.getGatewayDescription();	
		
	})

	client.on(KNXClientEvents.descriptionResponse, (datagram) => {
		// This function is called whenever a KNX telegram arrives from BUS
		 console.log("****DESCRIPTION RESPONSE***", JSON.stringify(datagram));
	 });
	client.Connect()
}

   

initClient();

setTimeout(() => {
    process.exit(0);
}, 20000);
