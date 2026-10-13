/**
 * Example showing plain (non-secure) KNXnet/IP tunnelling over TCP.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import KNXClient, { KNXClientEvents } from '../src/KNXClient'
import CEMIConstants from '../src/protocol/cEMI/CEMIConstants'

/**
 * Usage:
 * - `KNX_GATEWAY_IP` (e.g. 192.168.1.10): an interface that offers TCP tunnelling
 * - Optional: `KNX_GA_COMMAND` (default 0/1/26), written ON then OFF
 *
 * Over TCP the transport is reliable: no TUNNELING_ACK is exchanged, as the
 * KNXnet/IP specification requires. Interfaces that only offer UDP refuse the
 * TCP connection: use `hostProtocol: 'TunnelUDP'` (samplePlainTunnelUPD.ts).
 */

async function main() {
  const ipAddr = (process.env.KNX_GATEWAY_IP || '192.168.1.10').trim()
  const gaCommand = (process.env.KNX_GA_COMMAND || '0/1/26').trim()

  const client = new KNXClient({
    hostProtocol: 'TunnelTCP',
    ipAddr,
    ipPort: Number(process.env.KNX_GATEWAY_PORT || 3671),
    isSecureKNXEnabled: false, // plain TCP tunnelling
    loglevel: 'info',
  })

  client.on(KNXClientEvents.error, (e) => console.error('Error:', e.message))
  client.on(KNXClientEvents.disconnected, (reason) =>
    console.log('Disconnected:', reason),
  )
  client.on(KNXClientEvents.indication, (packet: any, echoed: boolean) => {
    const cemi = packet?.cEMIMessage
    if (echoed || cemi?.msgCode !== CEMIConstants.L_DATA_IND) return
    console.log(
      `${cemi.srcAddress?.toString?.()} -> ${cemi.dstAddress?.toString?.()}`,
      cemi.npdu?.dataValue,
    )
  })

  const connected = new Promise<void>((resolve) => {
    client.once(KNXClientEvents.connected, () => resolve())
  })
  client.Connect()
  await connected
  console.log(`✓ Plain TCP tunnel connected to ${ipAddr}`)

  client.write(gaCommand, true, '1.001')
  await new Promise((r) => setTimeout(r, 2000))
  client.write(gaCommand, false, '1.001')
  await new Promise((r) => setTimeout(r, 2000))

  await client.Disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
