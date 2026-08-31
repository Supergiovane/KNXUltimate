/**
 * Demonstrates automatic reconnection after an unexpected KNX connection loss.
 *
 * Run with:
 * node -r esbuild-register -e "require('./examples/autoReconnect.ts')" 192.168.1.10
 *
 * To test it, disconnect or restart the KNX/IP interface while this example is
 * running, then restore it. Do not call Disconnect() to simulate a failure:
 * Disconnect() intentionally stops automatic reconnection.
 *
 * This example only monitors the connection and does not send KNX telegrams.
 */

import { KNXClient, KNXClientEvents, KNXClientOptions } from '../src'

const gatewayIp = process.argv[2] || process.env.KNX_GATEWAY_IP

if (!gatewayIp) {
	console.error(
		'Provide the KNX/IP interface address as the first argument or set KNX_GATEWAY_IP.',
	)
	process.exit(1)
}

const options: KNXClientOptions = {
	ipAddr: gatewayIp,
	ipPort: Number(process.env.KNX_GATEWAY_PORT || 3671),
	hostProtocol: 'TunnelUDP',
	autoReconnect: true,
	loglevel: 'info',
}

const client = new KNXClient(options)
let successfulConnections = 0
let shuttingDown = false

client.on(KNXClientEvents.connecting, () => {
	console.log(`Connecting to ${options.ipAddr}:${options.ipPort}...`)
})

client.on(KNXClientEvents.connected, () => {
	successfulConnections += 1
	const connectionType =
		successfulConnections === 1 ? 'Connected' : 'Reconnected'
	console.log(`${connectionType} to the KNX BUS.`)
	console.log(
		'Disconnect or restart the KNX/IP interface to test automatic reconnection.',
	)
})

client.on(KNXClientEvents.disconnected, (reason) => {
	console.log(`Disconnected: ${reason}`)
	if (!shuttingDown) {
		console.log('Automatic reconnection is enabled; retrying every 5 seconds.')
	}
})

client.on(KNXClientEvents.error, (error) => {
	console.error(`KNX error: ${error.message}`)
})

async function shutdown(signal: string) {
	if (shuttingDown) return
	shuttingDown = true
	console.log(`\n${signal} received. Stopping automatic reconnection...`)

	try {
		await client.Disconnect()
	} catch (error) {
		console.error(
			`Error while disconnecting: ${
				error instanceof Error ? error.message : String(error)
			}`,
		)
	} finally {
		process.exit(0)
	}
}

process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))

client.Connect()
