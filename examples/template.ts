/**
 * Template showing a fully documented KNX connection workflow.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import KNXClient, { KNXClientEvents, KNXClientOptions, SecureConfig } from '../src/KNXClient'
import { resolve as resolveDatapoint, fromBuffer as decodeFromBuffer } from '../src/dptlib'
import { wait } from '../src/utils'

/**
 * Toggle this value (or pass it via environment variable) to choose between plain and secure setups.
 * - Plain mode uses multicast/UDP and works with classic KNX/IP routers.
 * - Secure mode requires ETS keyrings or explicit tunnel credentials.
 */
const connectionMode = (process.env.KNX_MODE || 'plain').toLowerCase().trim() === 'secure' ? 'secure' : 'plain'

/**
 * Plain routing/tunnelling configuration (no encryption).
 * Adjust the IP/port according to your KNX/IP interface or router.
 */
const plainOptions: KNXClientOptions = {
  ipAddr: '224.0.23.12', // Multicast address used by KNX routers (use interface IP for TunnelUDP)
  ipPort: 3671,
  hostProtocol: 'Multicast', // Change to 'TunnelUDP' when connecting to a point-to-point interface
  physAddr: '1.1.100', // Set your individual address; leave blank to auto-select if supported
  loglevel: 'info',
  suppress_ack_ldatareq: false,
  isSecureKNXEnabled: false,
}

/**
 * Secure tunnelling configuration example.
 * Requires ETS keyring path/password OR explicit tunnel credentials.
 * Comment/uncomment the relevant block to match your environment.
 */
const secureConfig: SecureConfig = {
  knxkeys_file_path: '/path/to/project.knxkeys', // Replace with your ETS keyring path
  knxkeys_password: 'your-keyring-password',
  // If you do not have a keyring, comment the two lines above and provide manual tunnel credentials:
  // tunnelInterfaceIndividualAddress: '1.1.254',
  // tunnelUserPassword: 'your-tunnel-password',
  // tunnelUserId: 2,
}

/**
 * Secure connection options extend the base KNX client options.
 */
const secureOptions: KNXClientOptions = {
  ipAddr: '192.168.1.10', // IP address of the secure KNX/IP interface
  ipPort: 3671,
  hostProtocol: 'TunnelTCP',
  physAddr: '1.1.200', // Optional; when omitted, the client negotiates an available tunnel IA from the keyring
  loglevel: 'info',
  isSecureKNXEnabled: true,
  secureTunnelConfig: secureConfig,
}

/**
 * Build the final KNXClientOptions choosing the correct template.
 */
function buildClientOptions(): KNXClientOptions {
  return connectionMode === 'secure' ? secureOptions : plainOptions
}

/**
 * Encode a JavaScript value into a KNX payload using the provided datapoint ID.
 */
function encodeValue(datapoint: string, value: unknown): Buffer {
  const config = resolveDatapoint(datapoint)
  const apdu = config.formatAPDU?.(value)
  if (!apdu) {
    throw new Error(`Unable to encode value for datapoint ${datapoint}`)
  }
  return apdu
}

/**
 * Decode a raw KNX payload using the provided datapoint ID.
 */
function decodeValue(datapoint: string, payload: Buffer | undefined): unknown {
  if (!payload) return null
  const config = resolveDatapoint(datapoint)
  return decodeFromBuffer(payload, config)
}

/**
 * Helper to send a group write telegram.
 * Call this from anywhere in your application logic once the client is connected.
 */
async function sendGroupValue(
  client: KNXClient,
  groupAddress: string,
  datapoint: string,
  value: unknown,
): Promise<void> {
  const encoded = encodeValue(datapoint, value)
  if (!client.clearToSend) {
    console.warn('Client not clear to send; waiting 100ms before retrying')
    await wait(100)
  }
  client.write(groupAddress, value, datapoint)
  console.log(`Sent ${groupAddress} ->`, value, `(DP ${datapoint}, encoded ${encoded.toString('hex')})`)
}

async function main() {
  const options = buildClientOptions()
  console.log(`Starting KNXClient in ${connectionMode.toUpperCase()} mode`)
  const client = new KNXClient(options)

  // --- Event handlers -----------------------------------------------------

  client.on(KNXClientEvents.connecting, () => {
    console.log('Connecting to gateway with options:', {
      ipAddr: options.ipAddr,
      ipPort: options.ipPort,
      hostProtocol: options.hostProtocol,
      secure: options.isSecureKNXEnabled,
    })
  })

  client.on(KNXClientEvents.connected, async () => {
    console.log('KNXClient connected; ready to exchange telegrams')

    // Example: send a boolean to GA 1/1/1 using datapoint 1.001
    try {
      await sendGroupValue(client, '1/1/1', '1.001', true)
    } catch (error) {
      console.error('Failed to send example telegram:', error)
    }
  })

  client.on(KNXClientEvents.indication, (datagram) => {
    const cemi = datagram.cEMIMessage
    const dst = cemi?.dstAddress?.toString?.() || 'unknown'
    const src = cemi?.srcAddress?.toString?.() || 'unknown'
    const payload = cemi?.npdu?.dataValue

    // Example: decode payloads for two known group addresses
    let decoded: unknown
    if (dst === '1/1/1') {
      decoded = decodeValue('1.001', payload)
    } else if (dst === '1/1/2') {
      decoded = decodeValue('9.001', payload)
    }

    console.log('Indication received:', {
      src,
      dst,
      event: cemi?.npdu?.isGroupWrite
        ? 'GroupValue_Write'
        : cemi?.npdu?.isGroupResponse
        ? 'GroupValue_Response'
        : cemi?.npdu?.isGroupRead
        ? 'GroupValue_Read'
        : 'Other',
      raw: payload?.toString('hex') ?? '(none)',
      decoded,
    })
  })

  client.on(KNXClientEvents.error, (error) => {
    console.error('KNX error:', error)
  })

  client.on(KNXClientEvents.disconnected, (reason) => {
    console.log('Disconnected from gateway:', reason)
  })

  // --- Lifecycle management ----------------------------------------------

  client.Connect()

  // Graceful shutdown on Ctrl+C / termination
  async function shutdown(signal: string) {
    console.log(`Received ${signal}; closing KNX connection...`)
    try {
      await client.Disconnect()
    } catch (error) {
      console.error('Error during disconnect:', error)
    } finally {
      process.exit(0)
    }
  }

  process.once('SIGINT', () => shutdown('SIGINT'))
  process.once('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((error) => {
  console.error('Fatal error in template example:', error)
  process.exit(1)
})
