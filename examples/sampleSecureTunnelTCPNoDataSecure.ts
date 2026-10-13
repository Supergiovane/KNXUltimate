/**
 * Example showing secure TCP tunnelling without Data Secure.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import KNXClient, { SecureConfig } from '../src/KNXClient'
import CEMIConstants from '../src/protocol/cEMI/CEMIConstants'

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

async function waitForStatus(client: KNXClient, ga: string, timeoutMs = 5000): Promise<number> {
  // Wait for a single-bit response directed to the status GA
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      client.off('indication', onInd)
      reject(new Error('Timeout waiting for status'))
    }, timeoutMs)

    // Note: packet.cEMIMessage is ensured to be plain (decrypted)
    // if the telegram was Data Secure and keys are available.
    const onInd = (packet: any) => {
      try {
        const cemi = packet?.cEMIMessage
        if (!cemi || cemi.msgCode !== CEMIConstants.L_DATA_IND) return
        if (cemi.dstAddress?.toString?.() !== ga) return
        // Consider both GroupValueResponse and GroupValueWrite as valid status
        const isResp = cemi.npdu?.isGroupResponse
        const isWrite = cemi.npdu?.isGroupWrite
        if (isResp || isWrite) {
          const dv: Buffer = cemi.npdu?.dataValue ?? Buffer.alloc(1, 0)
          const bit = (dv.readUInt8(0) ?? 0) & 0x01
          clearTimeout(t)
          client.off('indication', onInd)
          resolve(bit)
        }
      } catch {}
    }
    client.on('indication', onInd)
  })
}

async function main() {
  // Manual secure credentials, no ETS keyring: the IP channel is secured, but
  // without group keys Data Secure group addresses cannot be used. To use them,
  // pass the keys in secureTunnelConfig.groupKeys (see
  // sampleSecureTunnelTCPGroupKeys.ts) or use the keyring (sampleSecureTunnelTCP.ts).
  const tunnelUserId = Number(env('KNX_TUNNEL_USER_ID'))
  if (!Number.isInteger(tunnelUserId)) {
    throw new Error('KNX_TUNNEL_USER_ID must be an integer.')
  }
  const deviceAuthenticationPassword = process.env.KNX_DEVICE_AUTH_CODE
  const gaCommand = env('KNX_GA_COMMAND', '1/2/1')
  const gaStatus = env('KNX_GA_STATUS', '1/2/2')

  const secureCfg: SecureConfig = {
    tunnelUserPassword: secret('KNX_TUNNEL_PASSWORD'),
    tunnelUserId,
    // Recommended: the gateway's device authentication code, so the client can
    // verify it is talking to the real gateway (without it a warning is logged).
    // Optionally set KNX_DEVICE_AUTH_CODE to authenticate the gateway.
    deviceAuthenticationPassword:
      deviceAuthenticationPassword === '' ? undefined : deviceAuthenticationPassword,
    // tunnelInterfaceIndividualAddress is not needed without a keyring.
  }

  const client = new KNXClient({
    // Secure tunnel without Data Secure (password/user provided manually)
    hostProtocol: 'TunnelTCP',
    ipAddr: env('KNX_GATEWAY_IP'),
    ipPort: Number(process.env.KNX_GATEWAY_PORT || 3671),
    isSecureKNXEnabled: true,
    secureTunnelConfig: secureCfg,
    loglevel: 'debug'
  })

  client.on('connected', () => console.log('✓ KNXClient connected (secure)'))
  client.on('error', (e) => console.error('Error:', e.message))
  client.on('disconnected', (reason) => console.log('Disconnected:', reason))

  try {
    client.Connect()
    // Ensure the secure tunnel is established before continuing
    await new Promise<void>((resolve) => client.once('connected', () => resolve()))

    console.log('\nTEST: ON/OFF', gaCommand, 'with status check', gaStatus, '(plain group addresses)')
    // ON
    client.write(gaCommand, true, '1.001')
    // Small delay before reading status to avoid racing immediately after write
    await new Promise((r) => setTimeout(r, 150))
    client.read(gaStatus)
    const onVal = await waitForStatus(client, gaStatus, 5000)
    console.log(`Status after ON: ${onVal ? 'ON' : 'OFF'}`)
    if (onVal !== 1) throw new Error('Unexpected status after ON (expected ON)')

    // OFF
    client.write(gaCommand, false, '1.001')
    await new Promise((r) => setTimeout(r, 150))
    client.read(gaStatus)
    const offVal = await waitForStatus(client, gaStatus, 5000)
    console.log(`Status after OFF: ${offVal ? 'ON' : 'OFF'}`)
    if (offVal !== 0) throw new Error('Unexpected status after OFF (expected OFF)')

    console.log('\nCommands sent and status verified correctly.')
    console.log('Waiting 5s before closing the connection (KNX spec).')
    await new Promise((r) => setTimeout(r, 5000))
  } catch (err) {
    console.error('\nError:', err)
  } finally {
    await client.Disconnect()
  }
}

main().catch(console.error)
