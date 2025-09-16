import KNXClient, { SecureConfig } from '../src/KNXClient'
import CEMIConstants from '../src/protocol/cEMI/CEMIConstants'

async function waitForStatus(
  client: KNXClient,
  ga: string,
  fallbackGa?: string,
  timeoutMs = 5000,
): Promise<number> {
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
        const dst = cemi.dstAddress?.toString?.()
        if (dst !== ga && dst !== (fallbackGa || '')) return
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
  console.log('🚀 Connecting KNX/IP (Multicast, Secure Routing)')

  // KNX Secure routing (multicast) config - uses Backbone key from ETS keyring
  const secureCfg: SecureConfig = {
    knxkeys_file_path:
      '/Users/massimosaccani/Documents/GitHub/KNXUltimate/documents/Secure Test.knxkeys',
    knxkeys_password: 'passwordprogetto'
  }

  const client = new KNXClient({
    hostProtocol: 'Multicast',
    ipAddr: '224.0.23.12',
    ipPort: 3671,
    isSecureKNXEnabled: true,
    secureTunnelConfig: secureCfg,
    loglevel: 'info',
    physAddr: '1.1.0' // The same as your KNX Router.
  })

  client.on('connected', () => console.log('✓ KNXClient connected (secure multicast)'))
  client.on('error', (e) => console.error('Error:', e.message))
  client.on('disconnected', (reason) => console.log('Disconnected:', reason))

  try {
    client.Connect()
    await new Promise<void>((resolve) => client.once('connected', () => resolve()))

    // Give the router a moment to emit TimerNotify (0955) and align our timer
    await new Promise((r) => setTimeout(r, 1000))

    // Example GA - adjust to your installation (no env vars)
    const cmdGA = '1/1/1'
    const statusGA = '1/1/2'

    // Log indications for the target groups
    client.on('indication', (packet: any) => {
      try {
        const cemi = packet?.cEMIMessage
        if (!cemi || cemi.msgCode !== CEMIConstants.L_DATA_IND) return
        const dst = cemi.dstAddress?.toString?.()
        if (dst !== cmdGA && dst !== statusGA) return
        const isResp = cemi.npdu?.isGroupResponse
        const isWrite = cemi.npdu?.isGroupWrite
        const raw: Buffer | undefined = cemi.npdu?.dataValue
        console.log(`IND dst=${dst} type=${isResp ? 'RESP' : isWrite ? 'WRITE' : 'OTHER'} data=${raw?.toString('hex')}`)
      } catch {}
    })

    console.log(`\nTEST (secure multicast): ON/OFF ${cmdGA} with status ${statusGA}`)

    // ON
    client.write(cmdGA, true, '1.001')
    await new Promise((r) => setTimeout(r, 300))
    client.read(statusGA)
    let onVal: number | undefined = undefined
    onVal = await waitForStatus(client, statusGA, cmdGA, 4000)
    console.log(`Status after ON: ${onVal ? 'ON' : 'OFF'}`)
    if (onVal !== 1) throw new Error('Unexpected status after ON (expected ON)')

    // OFF
    client.write(cmdGA, false, '1.001')
    await new Promise((r) => setTimeout(r, 300))
    client.read(statusGA)
    let offVal: number | undefined = undefined
    offVal = await waitForStatus(client, statusGA, cmdGA, 4000)
     console.log(`Status after OFF: ${offVal ? 'ON' : 'OFF'}`)
    if (offVal !== 0) throw new Error('Unexpected status after OFF (expected OFF)')

    console.log('\nCommands sent and status verified correctly (secure multicast).')
    console.log('Waiting 3s before closing...')
    await new Promise((r) => setTimeout(r, 3000))
  } catch (err) {
    console.error('\nError:', err)
  } finally {
    await client.Disconnect()
  }
}

main().catch(console.error)
