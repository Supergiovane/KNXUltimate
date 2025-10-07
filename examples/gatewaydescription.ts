/**
 * Example fetching KNX gateway descriptions.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

// Fetch extended gateway descriptions for every discovered interface
import { setTimeout } from 'timers'
import { KNXClient, KNXDescriptionResponse } from '../src'

async function initClient() {

	// Discover available gateways
	const knxGateways = await KNXClient.discover(5000)
	if(knxGateways.length === 0) {
		console.log('No gateway found')
		return
	}
	console.log('Discovered gateways:', knxGateways)

	// For each discovered gateway, fetch its description payloads (usually a single entry)
	// Each description exposes metadata, supported transports, and service families
	for (let index = 0; index < knxGateways.length; index++) {

		const element = knxGateways[index];
		const [ip, port, name] = element.split(':')
		console.log('Gathering info of', ip,port,name)
		
		// Request the description list with a generous timeout
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

// Exit after 30 seconds so the script does not linger
setTimeout(() => {
    process.exit(0);
}, 30000);
