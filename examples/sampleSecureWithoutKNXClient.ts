import { SecureTunnelTCP, SecureConfig } from '../src/secure/SecureTunnelTCP'

async function main() {
  // Secure configuration (aligned with current parameters)
  const cfg: SecureConfig = {
    gatewayIp: '192.168.1.4',
    gatewayPort: 3671,
    tunnelInterfaceIndividualAddress: '1.1.254',
    knxkeys_file_path:
      '/Users/massimosaccani/Documents/GitHub/KNXUltimate/documents/Secure Test.knxkeys',
    knxkeys_password: 'passwordprogetto',
    debug: true,
  }

  const knx = new SecureTunnelTCP(cfg)

  try {
    console.log('🚀 Connecting KNX/IP Secure (SecureTunnelTCP only)')
    await knx.connect()
    console.log('✓ Connected (secure)')

    console.log('\nTEST: ON/OFF 1/1/1 with status check 1/1/2')

    // ON
    await knx.sendCommand('1/1/1', true)
    const onVal = await knx.readStatus('1/1/2')
    console.log(`Status after ON: ${onVal ? 'ON' : 'OFF'}`)

    // OFF
    await knx.sendCommand('1/1/1', false)
    const offVal = await knx.readStatus('1/1/2')
    console.log(`Status after OFF: ${offVal ? 'ON' : 'OFF'}`)

    console.log('\nCommands sent and status verified (SecureTunnelTCP).')
    console.log('Waiting 5s before closing the connection (KNX spec).')
    await new Promise((r) => setTimeout(r, 5000))
  } catch (err) {
    console.error('\nError:', err)
  } finally {
    knx.disconnect()
  }
}

main().catch(console.error)

