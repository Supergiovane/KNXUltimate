/**
 * Example: KNX/IP Tunneling server that prints Node-RED "MultiRouting RAW" messages.
 *
 * This does NOT require node-red-contrib-knx-ultimate; it just prints the same msg shape
 * that `knxUltimate-config.js` sends to `knxUltimateMultiRouting`/Filter nodes.
 *
 * Run:
 * - `TUNNEL_LISTEN_PORT=3671 npm run example:bridge:noderedmsg`
 *
 * Then point a KNX/IP tunneling client (e.g. LogicMachine) to this host:3671.
 */

import { KNXIPTunnelServer } from '../src'

async function main() {
	const listenHost = process.env.TUNNEL_LISTEN_HOST || '0.0.0.0'
	const listenPort = Number(process.env.TUNNEL_LISTEN_PORT || '3671')
	const advertiseHost = process.env.TUNNEL_ADVERTISE_HOST // optional
	const assignedIa = process.env.TUNNEL_ASSIGNED_IA || '15.15.255'

	const gatewayId = process.env.GATEWAY_ID || 'knxultimate-tunnel-server'
	const gatewayName = process.env.GATEWAY_NAME || 'KNX Tunneling Server'
	const gatewayPhysAddr = process.env.GATEWAY_PHYSADDR || assignedIa

	const outputtopic = process.env.OUTPUT_TOPIC || ''

	const server = new KNXIPTunnelServer({
		listenHost,
		listenPort,
		advertiseHost,
		assignedIndividualAddress: assignedIa,
		maxSessions: Number(process.env.TUNNEL_MAX_SESSIONS || '1'),
		loglevel: (process.env.LOG_LEVEL as any) || 'info',
	})

	server.on('listening', (a) => console.log('[tunnel] listening', a))
	server.on('sessionUp', (s) => console.log('[tunnel] session up', s))
	server.on('sessionDown', (s) => console.log('[tunnel] session down', s))
	server.on('error', (e) => console.error('[tunnel] error', e))

	server.on('rawTelegram', (knx) => {
		const msg = {
			topic: outputtopic || knx.destination,
			payload: {
				knx,
				knxMultiRouting: {
					gateway: { id: gatewayId, name: gatewayName, physAddr: gatewayPhysAddr },
					receivedAt: Date.now(),
				},
			},
		}

		// Buffer is serialized as { type: "Buffer", data: [...] } (same as Node-RED JSON).
		// eslint-disable-next-line no-console
		console.log(JSON.stringify(msg))
	})

	await server.start()

	process.on('SIGINT', async () => {
		console.log('Stopping...')
		await server.stop()
		process.exit(0)
	})
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})

