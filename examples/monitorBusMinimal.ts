/**
 * Example subscribing to KNX bus indications with minimal setup.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { KNXClient, KNXClientEvents, KNXClientOptions } from '../src'

const options: KNXClientOptions = {
  ipAddr: '224.0.23.12', // Replace with your gateway IP if needed
  ipPort: 3671,
  hostProtocol: 'Multicast',
  physAddr: '1.1.200',
  loglevel: 'info',
}

const client = new KNXClient(options)

client.on(KNXClientEvents.connected, () => {
  console.log('Connected to KNX gateway. Listening for telegrams...')
})

client.on(KNXClientEvents.indication, (datagram) => {
  const npdu = datagram.cEMIMessage.npdu
  const event = npdu.isGroupWrite
    ? 'GroupValue_Write'
    : npdu.isGroupResponse
    ? 'GroupValue_Response'
    : npdu.isGroupRead
    ? 'GroupValue_Read'
    : 'Other'
  const src = datagram.cEMIMessage.srcAddress.toString()
  const dst = datagram.cEMIMessage.dstAddress.toString()
  const payload = npdu.dataValue ? npdu.dataValue.toString('hex') : '(no payload)'
  console.log(`[${event}] ${src} -> ${dst} payload: ${payload}`)
})

client.on(KNXClientEvents.error, (error) => {
  console.error('KNX error:', error)
})

client.on(KNXClientEvents.disconnected, (reason) => {
  console.log('Disconnected from KNX gateway:', reason)
})

client.Connect()

async function shutdown() {
  console.log('\nStopping listener...')
  try {
    await client.Disconnect()
  } catch (error) {
    console.error('Error during disconnect:', error)
  }
  process.exit(0)
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
