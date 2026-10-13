/**
 * Example showing KNX Secure tunnelling over TCP without an ETS keyring:
 * manual tunnel credentials plus Data Secure group keys passed directly.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import KNXClient, {
  KNXClientEvents,
  type SecureConfig,
} from '../src/KNXClient'
import CEMIConstants from '../src/protocol/cEMI/CEMIConstants'

/**
 * Usage:
 * - `KNX_GATEWAY_IP` (e.g. 192.168.1.11)
 * - `KNX_TUNNEL_USER_ID` and `KNX_TUNNEL_PASSWORD`: tunnel user from ETS
 * - `KNX_DEVICE_AUTH_CODE`: device authentication code of the gateway (ETS)
 * - `KNX_GROUP_KEYS`: Data Secure keys as JSON, e.g. {"1/1/1":"<32 hex>","1/1/2":"<32 hex>"}
 * - Optional: `KNX_GA_COMMAND` (default 1/1/1) and `KNX_GA_STATUS` (default 1/1/2)
 *
 * The values can come from your own tooling (for example an ETS project
 * export) instead of a .knxkeys file.
 */

function env(name: string, fallback?: string): string {
  const value = (process.env[name] || '').trim() || fallback
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function secret(name: string): string {
  // Preserve whitespace because it may be significant in KNX credentials.
  const value = process.env[name]
  if (value === undefined || value.length === 0) throw new Error(`Missing ${name}`)
  return value
}

function waitForStatus(
  client: KNXClient,
  ga: string,
  timeoutMs = 5000,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const onInd = (packet: any) => {
      // cEMIMessage is already decrypted when the group key is known
      const cemi = packet?.cEMIMessage
      if (!cemi || cemi.msgCode !== CEMIConstants.L_DATA_IND) return
      if (cemi.dstAddress?.toString?.() !== ga) return
      if (!cemi.npdu?.isGroupResponse && !cemi.npdu?.isGroupWrite) return
      clearTimeout(timer)
      client.off(KNXClientEvents.indication, onInd)
      resolve((cemi.npdu?.dataValue?.[0] ?? 0) & 0x01)
    }
    const timer = setTimeout(() => {
      client.off(KNXClientEvents.indication, onInd)
      reject(new Error(`Timeout waiting for status on ${ga}`))
    }, timeoutMs)
    client.on(KNXClientEvents.indication, onInd)
  })
}

async function main() {
  const gaCommand = env('KNX_GA_COMMAND', '1/1/1')
  const gaStatus = env('KNX_GA_STATUS', '1/1/2')

  const secureCfg: SecureConfig = {
    tunnelUserId: Number(env('KNX_TUNNEL_USER_ID')),
    tunnelUserPassword: secret('KNX_TUNNEL_PASSWORD'),
    // Authenticates the gateway during the handshake
    deviceAuthenticationPassword: secret('KNX_DEVICE_AUTH_CODE'),
    // Refuse to connect if the gateway cannot be authenticated
    requireDeviceAuthentication: true,
    // { "1/1/1": "00112233445566778899aabbccddeeff", ... } (Buffer values work too)
    groupKeys: JSON.parse(env('KNX_GROUP_KEYS')),
    // tunnelInterfaceIndividualAddress is not needed without a keyring
  }

  const client = new KNXClient({
    hostProtocol: 'TunnelTCP',
    ipAddr: env('KNX_GATEWAY_IP', '192.168.1.11'),
    ipPort: Number(process.env.KNX_GATEWAY_PORT || 3671),
    isSecureKNXEnabled: true,
    secureTunnelConfig: secureCfg,
    loglevel: 'info',
  })

  client.on(KNXClientEvents.error, (e) => console.error('Error:', e.message))
  client.on(KNXClientEvents.disconnected, (reason) =>
    console.log('Disconnected:', reason),
  )

  const connected = new Promise<void>((resolve) => {
    client.once(KNXClientEvents.connected, () => resolve())
  })
  client.Connect()
  await connected
  console.log('✓ Secure tunnel connected (manual credentials + group keys)')

  try {
    for (const value of [true, false]) {
      const status = waitForStatus(client, gaStatus)
      client.write(gaCommand, value, '1.001')
      console.log(
        `${gaCommand} <- ${value ? 'ON' : 'OFF'}, status ${gaStatus}: ${(await status) ? 'ON' : 'OFF'}`,
      )
    }
  } catch (err) {
    console.error((err as Error).message)
  } finally {
    await client.Disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
