import KNXClient from '../src/KNXClient'
import CEMIConstants from '../src/protocol/cEMI/CEMIConstants'

async function waitForStatus(
  client: KNXClient,
  ga: string,
  timeoutMs = 5000,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      client.off('indication', onInd)
      reject(new Error('Timeout waiting for status'))
    }, timeoutMs)

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
    hostProtocol: 'TunnelUDP',
    ipAddr: '192.168.1.117',
    ipPort: 3671,
    isSecureKNXEnabled: false,
    physAddr:"15.15.250",
    // Keep legacy ACK behavior on UDP; adjust if needed
    suppress_ack_ldatareq: false,
    loglevel: 'debug',
    localEchoInTunneling: true,
  })

  client.on('connected', () => console.log('✓ KNXClient connected (plain UDP)'))
  client.on('error', (e) => console.error('Error:', e.message))
  client.on('disconnected', (reason) => console.log('Disconnected:', reason))

  try {
    client.Connect()
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

