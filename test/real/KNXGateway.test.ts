/**
 * Opt-in smoke tests against a real KNX/IP gateway.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import KNXClient, {
	KNXClientEvents,
	type KNXClientOptions,
	type KNXClientProtocol,
	type SecureConfig,
} from '../../src/KNXClient'
import type { LogLevel } from '../../src/KnxLog'

const DEFAULT_ENV_FILE = '.env.knx-test'
const envFile = path.resolve(
	process.cwd(),
	process.env.KNX_TEST_ENV_FILE || DEFAULT_ENV_FILE,
)
const envFileLoaded = loadEnvFile(envFile)
const testEnabled = getBoolean('KNX_TEST_ENABLED', false)

if (!testEnabled) {
	const reason = envFileLoaded
		? `set KNX_TEST_ENABLED=true in ${envFile}`
		: `create ${envFile} from .env.knx-test.example`
	console.log(`[real KNX gateway] skipped: ${reason}`)
}

describe('real KNX gateway', () => {
	it(
		'establishes a connection and optionally sends a group write',
		{
			skip: !testEnabled,
			timeout: getTestTimeout(),
		},
		async () => {
			const config = readTestConfig()
			const client = new KNXClient(buildClientOptions(config))
			const observedErrors: string[] = []

			client.on(KNXClientEvents.error, (error) => {
				observedErrors.push(error.message)
				console.error(`[real KNX gateway] ${error.message}`)
			})
			client.on(KNXClientEvents.disconnected, (reason) => {
				console.log(`[real KNX gateway] disconnected: ${reason}`)
			})

			try {
				const connected = waitForConnected(
					client,
					config.connectTimeoutMs,
				)
				client.Connect()
				await connected

				assert.strictEqual(client.isConnected(), true)
				if (
					config.protocol === 'TunnelTCP' ||
					config.protocol === 'TunnelUDP'
				) {
					assert.notStrictEqual(
						client.channelID,
						null,
						'tunnel connected without an assigned channel ID',
					)
				}

				console.log('[real KNX gateway] connected', {
					protocol: config.protocol,
					gateway: `${config.gatewayIp}:${config.gatewayPort}`,
					secure: config.secure,
					channelId: client.channelID,
					physicalAddress: client.physAddr?.toString?.(),
				})

				if (config.write) {
					await sendConfiguredWrite(client, config)
				}

				assert.deepStrictEqual(
					observedErrors,
					[],
					`gateway emitted errors: ${observedErrors.join('; ')}`,
				)
			} finally {
				try {
					await client.Disconnect()
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error)
					if (
						message !== 'No client socket defined' &&
						message !== 'Already disconnecting'
					) {
						console.warn(`[real KNX gateway] cleanup: ${message}`)
					}
				}
			}
		},
	)
})

type RealGatewayConfig = {
	protocol: KNXClientProtocol
	gatewayIp: string
	gatewayPort: number
	networkInterface?: string
	physicalAddress?: string
	secure: boolean
	logLevel: LogLevel
	connectTimeoutMs: number
	secureConfig?: SecureConfig
	write?: {
		groupAddress: string
		dpt: string
		value: unknown
		ackTimeoutMs: number
		postWriteWaitMs: number
	}
}

function loadEnvFile(filePath: string): boolean {
	if (!fs.existsSync(filePath)) return false

	for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
		const line = rawLine.trim()
		if (!line || line.startsWith('#')) continue

		const separator = line.indexOf('=')
		if (separator <= 0) {
			throw new Error(`Invalid environment line in ${filePath}: ${line}`)
		}

		const key = line.slice(0, separator).trim()
		if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
			throw new Error(`Invalid environment key in ${filePath}: ${key}`)
		}

		let value = line.slice(separator + 1).trim()
		const quote = value[0]
		if (
			(quote === '"' || quote === "'") &&
			value.length >= 2 &&
			value[value.length - 1] === quote
		) {
			value = value.slice(1, -1)
		}

		if (process.env[key] === undefined) process.env[key] = value
	}

	return true
}

function getOptional(name: string): string | undefined {
	const value = process.env[name]?.trim()
	return value || undefined
}

function getRequired(name: string): string {
	const value = getOptional(name)
	if (!value) throw new Error(`Missing required environment variable ${name}`)
	return value
}

function getBoolean(name: string, fallback: boolean): boolean {
	const value = getOptional(name)
	if (value === undefined) return fallback
	if (value === 'true' || value === '1') return true
	if (value === 'false' || value === '0') return false
	throw new Error(`${name} must be true, false, 1 or 0`)
}

function getInteger(
	name: string,
	fallback?: number,
	min = 0,
	max = Number.MAX_SAFE_INTEGER,
): number {
	const value = getOptional(name)
	if (value === undefined && fallback !== undefined) return fallback
	if (value === undefined) {
		throw new Error(`Missing required environment variable ${name}`)
	}

	const parsed = Number(value)
	if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
		throw new Error(`${name} must be an integer between ${min} and ${max}`)
	}
	return parsed
}

function getProtocol(): KNXClientProtocol {
	const value = getOptional('KNX_TEST_PROTOCOL') || 'TunnelTCP'
	if (
		value !== 'TunnelTCP' &&
		value !== 'TunnelUDP' &&
		value !== 'Multicast'
	) {
		throw new Error(
			'KNX_TEST_PROTOCOL must be TunnelTCP, TunnelUDP or Multicast',
		)
	}
	return value
}

function getLogLevel(): LogLevel {
	const value = getOptional('KNX_TEST_LOG_LEVEL') || 'debug'
	if (
		value !== 'disable' &&
		value !== 'error' &&
		value !== 'warn' &&
		value !== 'info' &&
		value !== 'debug' &&
		value !== 'trace'
	) {
		throw new Error(
			'KNX_TEST_LOG_LEVEL must be disable, error, warn, info, debug or trace',
		)
	}
	return value
}

function getTestTimeout(): number {
	const connect = Number(process.env.KNX_TEST_CONNECT_TIMEOUT_MS) || 15000
	const ack = Number(process.env.KNX_TEST_WRITE_ACK_TIMEOUT_MS) || 5000
	const settle = Number(process.env.KNX_TEST_POST_WRITE_WAIT_MS) || 2000
	return connect + ack + settle + 5000
}

function readTestConfig(): RealGatewayConfig {
	const protocol = getProtocol()
	const secure = getBoolean('KNX_TEST_SECURE', protocol === 'TunnelTCP')
	if (protocol === 'TunnelTCP' && !secure) {
		throw new Error('TunnelTCP requires KNX_TEST_SECURE=true')
	}
	if (protocol === 'TunnelUDP' && secure) {
		throw new Error('TunnelUDP requires KNX_TEST_SECURE=false')
	}

	const config: RealGatewayConfig = {
		protocol,
		gatewayIp:
			getOptional('KNX_TEST_GATEWAY_IP') ||
			(protocol === 'Multicast' ? '224.0.23.12' : ''),
		gatewayPort: getInteger('KNX_TEST_GATEWAY_PORT', 3671, 1, 65535),
		networkInterface: getOptional('KNX_TEST_INTERFACE'),
		physicalAddress: getOptional('KNX_TEST_PHYS_ADDR'),
		secure,
		logLevel: getLogLevel(),
		connectTimeoutMs: getInteger(
			'KNX_TEST_CONNECT_TIMEOUT_MS',
			15000,
			1000,
		),
	}

	if (!config.gatewayIp) {
		throw new Error(
			'KNX_TEST_GATEWAY_IP is required for TunnelTCP and TunnelUDP',
		)
	}
	if (protocol === 'Multicast' && !config.physicalAddress) {
		throw new Error('KNX_TEST_PHYS_ADDR is required for Multicast')
	}
	if (secure) config.secureConfig = readSecureConfig(protocol)

	if (getBoolean('KNX_TEST_WRITE_ENABLED', false)) {
		const rawValue = getRequired('KNX_TEST_WRITE_VALUE_JSON')
		let value: unknown
		try {
			value = JSON.parse(rawValue)
		} catch (error) {
			throw new Error(
				`KNX_TEST_WRITE_VALUE_JSON is not valid JSON: ${
					error instanceof Error ? error.message : String(error)
				}`,
			)
		}
		config.write = {
			groupAddress: getRequired('KNX_TEST_WRITE_GA'),
			dpt: getRequired('KNX_TEST_WRITE_DPT'),
			value,
			ackTimeoutMs: getInteger(
				'KNX_TEST_WRITE_ACK_TIMEOUT_MS',
				5000,
				250,
			),
			postWriteWaitMs: getInteger('KNX_TEST_POST_WRITE_WAIT_MS', 2000, 0),
		}
	}

	return config
}

function readSecureConfig(protocol: KNXClientProtocol): SecureConfig {
	const keyringPath = getOptional('KNX_TEST_KEYRING_PATH')
	const keyringPassword = getOptional('KNX_TEST_KEYRING_PASSWORD')
	const tunnelPassword = getOptional('KNX_TEST_TUNNEL_PASSWORD')
	const tunnelUserId = getOptional('KNX_TEST_TUNNEL_USER_ID')
	const secureConfig: SecureConfig = {
		tunnelInterfaceIndividualAddress: getOptional('KNX_TEST_TUNNEL_IA'),
		deviceAuthenticationPassword: getOptional(
			'KNX_TEST_DEVICE_AUTH_PASSWORD',
		),
	}

	if (keyringPath) {
		if (!keyringPassword) {
			throw new Error(
				'KNX_TEST_KEYRING_PASSWORD is required with KNX_TEST_KEYRING_PATH',
			)
		}
		const resolvedPath = path.resolve(process.cwd(), keyringPath)
		if (!fs.existsSync(resolvedPath)) {
			throw new Error(`KNX keyring not found: ${resolvedPath}`)
		}
		secureConfig.knxkeys_file_path = resolvedPath
		secureConfig.knxkeys_password = keyringPassword
	}

	if (tunnelPassword) secureConfig.tunnelUserPassword = tunnelPassword
	if (tunnelUserId) {
		secureConfig.tunnelUserId = getInteger(
			'KNX_TEST_TUNNEL_USER_ID',
			undefined,
			1,
			255,
		)
	}

	if (protocol === 'Multicast' && !keyringPath) {
		throw new Error('secure Multicast requires KNX_TEST_KEYRING_PATH')
	}
	if (protocol === 'TunnelTCP' && !keyringPath && !tunnelPassword) {
		throw new Error(
			'secure TunnelTCP requires a keyring or KNX_TEST_TUNNEL_PASSWORD',
		)
	}
	if (tunnelPassword && !tunnelUserId) {
		throw new Error(
			'KNX_TEST_TUNNEL_USER_ID is required with KNX_TEST_TUNNEL_PASSWORD',
		)
	}
	if (
		protocol === 'TunnelTCP' &&
		!keyringPath &&
		tunnelPassword &&
		!secureConfig.tunnelInterfaceIndividualAddress
	) {
		throw new Error(
			'manual TunnelTCP requires KNX_TEST_TUNNEL_IA with the tunnel password',
		)
	}

	return secureConfig
}

function buildClientOptions(config: RealGatewayConfig): KNXClientOptions {
	const options: KNXClientOptions = {
		hostProtocol: config.protocol,
		ipAddr: config.gatewayIp,
		ipPort: config.gatewayPort,
		isSecureKNXEnabled: config.secure,
		loglevel: config.logLevel,
	}

	if (config.networkInterface) options.interface = config.networkInterface
	if (config.physicalAddress) options.physAddr = config.physicalAddress
	if (config.secureConfig) options.secureTunnelConfig = config.secureConfig
	return options
}

function waitForConnected(client: KNXClient, timeoutMs: number): Promise<void> {
	return new Promise((resolve, reject) => {
		const cleanup = () => {
			clearTimeout(timer)
			client.off(KNXClientEvents.connected, onConnected)
			client.off(KNXClientEvents.error, onError)
			client.off(KNXClientEvents.disconnected, onDisconnected)
		}
		const onConnected = () => {
			cleanup()
			resolve()
		}
		const onError = (error: Error) => {
			cleanup()
			reject(error)
		}
		const onDisconnected = (reason: string) => {
			cleanup()
			reject(new Error(`Disconnected while connecting: ${reason}`))
		}
		const timer = setTimeout(() => {
			cleanup()
			reject(
				new Error(
					`Timeout after ${timeoutMs} ms waiting for the connected event`,
				),
			)
		}, timeoutMs)

		client.once(KNXClientEvents.connected, onConnected)
		client.once(KNXClientEvents.error, onError)
		client.once(KNXClientEvents.disconnected, onDisconnected)
	})
}

async function sendConfiguredWrite(
	client: KNXClient,
	config: RealGatewayConfig,
): Promise<void> {
	assert.ok(config.write)
	const ack =
		config.protocol === 'TunnelTCP' || config.protocol === 'TunnelUDP'
			? waitForAck(client, config.write.ackTimeoutMs)
			: undefined

	console.log('[real KNX gateway] writing', {
		groupAddress: config.write.groupAddress,
		dpt: config.write.dpt,
		value: config.write.value,
	})
	client.write(
		config.write.groupAddress,
		config.write.value,
		config.write.dpt,
	)

	if (ack) await ack
	if (config.write.postWriteWaitMs > 0) {
		await delay(config.write.postWriteWaitMs)
	}
}

function waitForAck(client: KNXClient, timeoutMs: number): Promise<void> {
	return new Promise((resolve, reject) => {
		const cleanup = () => {
			clearTimeout(timer)
			client.off(KNXClientEvents.ackReceived, onAck)
		}
		const onAck = (_packet: unknown, acknowledged: boolean) => {
			cleanup()
			if (acknowledged) resolve()
			else reject(new Error('Gateway did not acknowledge the write'))
		}
		const timer = setTimeout(() => {
			cleanup()
			reject(
				new Error(
					`Timeout after ${timeoutMs} ms waiting for the tunnelling ACK`,
				),
			)
		}, timeoutMs)

		client.once(KNXClientEvents.ackReceived, onAck)
	})
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms)
	})
}
