/**
 * Example fetching KNX gateway descriptions.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

// Get the gateway description of each gatewau found
import { setTimeout } from 'timers'
import { KNXClient, KNXDescriptionResponse } from '../src'

async function initClient() {

	// Discover all gateways
	const knxGateways = await KNXClient.discover(5000)
	if(knxGateways.length === 0) {
		console.log('No gateway found')
		return
	}
	console.log('Discovered gateways:', knxGateways)

	// For each discovered gateway, get all possible device descriptions (usually only one)
	// A description is a JSON object containing all details of the device and also what type of connection (Multicast, unicast, etc), it suppports
	for (let index = 0; index < knxGateways.length; index++) {

		const element = knxGateways[index];
		const [ip, port, name] = element.split(':')
		console.log('Gathering info of', ip,port,name)
		
		const descriptionsJSON = await KNXClient.getGatewayDescription(ip,port,5000)
		if(descriptionsJSON.length === 0) {
			console.log('No description found for this device.')
		}

		for (let index = 0; index < descriptionsJSON.length; index++) {
			const element = descriptionsJSON[index] as KNXDescriptionResponse;
			console.log(element)
		}

	}
}

initClient();

setTimeout(() => {
    process.exit(0);
}, 30000);
