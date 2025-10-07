/**
 * Example demonstrating plain KNX multicast routing.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import KNXClient from '../src/KNXClient'
import { dptlib } from '../src'
import CEMIConstants from '../src/protocol/cEMI/CEMIConstants'

async function waitForStatus(
  client: KNXClient,
  ga: string,
  timeoutMs = 5000,
): Promise<number> {
  // Await a group indication targeting the provided GA and return its 1-bit value
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
  console.log('🚀 Connecting KNX/IP (TunnelUDP, plain)')

  const client = new KNXClient({
    // Plain routing configuration: multicast + no secure wrapper
    hostProtocol: 'Multicast',
    ipAddr: '224.0.23.12',
    ipPort: 3671,
    physAddr:"15.15.250",
    isSecureKNXEnabled: false,
    loglevel: 'info'
  })

  client.on('connected', () => console.log('✓ KNXClient connected (plain UDP)'))
  client.on('error', (e) => console.error('Error:', e.message))
  client.on('disconnected', (reason) => console.log('Disconnected:', reason))

  // Example: decode incoming telegrams by datapoint, similar to simpleSample.ts
  // Note: packet.cEMIMessage is ensured to be plain (decrypted)
  // if the telegram was Data Secure and keys are available.
  client.on('indication', (packet: any) => {
    try {
      const cemi = packet?.cEMIMessage
      if (!cemi || !cemi.npdu) return
      const dst = cemi.dstAddress?.toString?.()
      const raw: Buffer | undefined = cemi.npdu?.dataValue
      if (!dst || !raw) return

      let jsValue: any
      if (dst === '0/1/1') {
        // We know 0/1/1 is a boolean DPT 1.001
        const config = dptlib.resolve('1.001')
        jsValue = dptlib.fromBuffer(raw, config)
      } else if (dst === '0/1/2') {
        // We know 0/1/2 is a DPT 232.600 Color RGB
        const config = dptlib.resolve('232.600')
        jsValue = dptlib.fromBuffer(raw, config)
      } else {
        // All others... assume they are boolean
        const config = dptlib.resolve('1.001')
        jsValue = dptlib.fromBuffer(raw, config)
        if (jsValue === null) {
          // Opppsss, it's null. It means that the datapoint isn't 1.001
          // Raise whatever error you want.
        }
      }
      console.log(`Indication dst=${dst} -> value=`, jsValue)
    } catch {}
  })

  try {
    client.Connect()
    // Wait until the transport is ready before issuing telegrams
    await new Promise<void>((resolve) => client.once('connected', () => resolve()))

    console.log('\nTEST: ON/OFF 0/1/1 with status check 0/1/25')

    // ON
    client.write('0/1/1', true, '1.001')
    await new Promise((r) => setTimeout(r, 1500))
    client.read('0/1/25')
    const onVal = await waitForStatus(client, '0/1/25', 5000)
    console.log(`Status after ON: ${onVal ? 'ON' : 'OFF'}`)
    await new Promise((r) => setTimeout(r, 5000))
    // OFF
    client.write('0/1/1', false, '1.001')
    await new Promise((r) => setTimeout(r, 1500))
    client.read('0/1/25')
    const offVal = await waitForStatus(client, '0/1/25', 5000)
    console.log(`Status after OFF: ${offVal ? 'ON' : 'OFF'}`)

    console.log('\nCommands sent and status verified (TunnelUDP).')
    console.log('Waiting 3s before closing the connection (cleanup).')
    await new Promise((r) => setTimeout(r, 3000))
  } catch (err) {
    console.error('\nError:', err)
  } finally {
    await client.Disconnect()
  }
}

main().catch(console.error)
