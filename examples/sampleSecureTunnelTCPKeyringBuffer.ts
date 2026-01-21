/**
 * Example showing KNX Secure tunnelling over TCP using the ETS keyring passed as a Buffer.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import fs from 'node:fs'
import path from 'node:path'

import KNXClient, { KNXClientEvents, type SecureConfig } from '../src/KNXClient'

/**
 * Usage:
 * - Set `KNX_GATEWAY_IP` (e.g. 192.168.1.4)
 * - Set `KNX_KEYS_PASSWORD` (ETS keyring password)
 * - Optional: `KNX_KEYS_PATH` (defaults to `documents/Secure Test.knxkeys`)
 * - Optional: `KNX_TUNNEL_IA` (e.g. 1.1.254). If omitted, the client auto-selects from the keyring.
 */

async function main() {
  const ipAddr = (process.env.KNX_GATEWAY_IP || '192.168.1.4').trim()
  const ipPort = Number(process.env.KNX_GATEWAY_PORT || 3671)

  const knxkeysPath =
    (process.env.KNX_KEYS_PATH || '').trim() ||
    path.join(process.cwd(), 'documents', 'Secure Test.knxkeys')

  const knxkeysPassword = (process.env.KNX_KEYS_PASSWORD || '').trim()
  if (!knxkeysPassword) {
    throw new Error('Missing KNX_KEYS_PASSWORD (ETS keyring password).')
  }

  // Load the raw `.knxkeys` file into memory and pass it to the client as a Buffer.
  const knxkeysBuffer = fs.readFileSync(knxkeysPath)

  const secureCfg: SecureConfig = {
    knxkeys_buffer: knxkeysBuffer,
    knxkeys_password: knxkeysPassword,
    tunnelInterfaceIndividualAddress: (process.env.KNX_TUNNEL_IA || '').trim() || undefined,
  }

  const client = new KNXClient({
    hostProtocol: 'TunnelTCP',
    ipAddr,
    ipPort,
    isSecureKNXEnabled: true,
    secureTunnelConfig: secureCfg,
    loglevel: 'info',
  })

  client.on(KNXClientEvents.connected, () => console.log('✓ Secure tunnel connected (keyring buffer)'))
  client.on(KNXClientEvents.error, (e) => console.error('Error:', e.message))
  client.on(KNXClientEvents.disconnected, (reason) => console.log('Disconnected:', reason))

  client.on(KNXClientEvents.indication, (packet: any) => {
    const cemi = packet?.cEMIMessage
    const dst = cemi?.dstAddress?.toString?.()
    const src = cemi?.srcAddress?.toString?.()
    const raw: Buffer | undefined = cemi?.npdu?.dataValue
    if (!dst || !src) return
    console.log('indication', { src, dst, raw: raw?.toString('hex') })
  })

  client.Connect()
}

main().catch((err) => console.error(err))

