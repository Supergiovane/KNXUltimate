/**
 * Example showing KNX Secure tunnelling over TCP.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import fs from 'node:fs'
import path from 'node:path'
import KNXClient, { SecureConfig } from '../src/KNXClient'
import CEMIConstants from '../src/protocol/cEMI/CEMIConstants'

async function waitForStatus(client: KNXClient, ga: string, timeoutMs = 5000): Promise<number> {
  // Resolve once a status telegram reaches the provided GA
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
  // KNX Secure + Data Secure configuration
  const knxkeysPath = path.join(process.cwd(), 'documents', 'Secure Test.knxkeys')
   const secureCfg: SecureConfig = {
     knxkeys_buffer: fs.readFileSync(knxkeysPath),
     // Alternative to knxkeys_buffer:
     // knxkeys_file_path: knxkeysPath,
     knxkeys_password: 'passwordprogetto',

    // If you do not have the ETS keyring, comment the block above and use the
    // manual secure credentials below. Data Secure will be unavailable.
   tunnelInterfaceIndividualAddress: '1.1.254',
    tunnelUserPassword: '6N.nv0sz', // Replace with your tunnel password
    tunnelUserId: 3, // Replace with the tunnel user ID defined in ETS
   }

  

  const client = new KNXClient({
    // Secure tunnel over TCP with Data Secure support from the keyring
    hostProtocol: 'TunnelTCP',
    ipAddr: '192.168.1.4',
    ipPort: 3671,
    isSecureKNXEnabled: true,
    secureTunnelConfig: secureCfg,
    loglevel: 'info'
  })

  client.on('connected', () => console.log('✓ KNXClient connected (secure)'))
  client.on('error', (e) => console.error('Error:', e.message))
  client.on('disconnected', (reason) => console.log('Disconnected:', reason))

  try {
    client.Connect()
    // Wait until the secure handshake finishes before driving the test
    await new Promise<void>((resolve) => client.once('connected', () => resolve()))

    console.log('\nTEST: ON/OFF 1/1/1 with status check 1/1/2')
    // ON
    client.write('1/1/1', true, '1.001')
    // Small delay before reading status to avoid racing immediately after write
    await new Promise((r) => setTimeout(r, 150))
    client.read('1/1/2')
    const onVal = await waitForStatus(client, '1/1/2', 5000)
    console.log(`Status after ON: ${onVal ? 'ON' : 'OFF'}`)
    if (onVal !== 1) throw new Error('Unexpected status after ON (expected ON)')

    // OFF
    client.write('1/1/1', false, '1.001')
    await new Promise((r) => setTimeout(r, 150))
    client.read('1/1/2')
    const offVal = await waitForStatus(client, '1/1/2', 5000)
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
