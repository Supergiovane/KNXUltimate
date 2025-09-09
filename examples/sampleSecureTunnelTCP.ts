import { SecureTunnelTCP, SecureConfig } from '../src/secure/SecureTunnelTCP'

async function main() {
  // Secure configuration (aligned with SecureConfig)
  const cfg: SecureConfig = {
    gatewayIp: '192.168.1.4', // KNX/IP gateway IP (router or interface)
    gatewayPort: 3671,        // KNX/IP gateway port (default 3671)
    tunnelInterfaceIndividualAddress: '1.1.254', // Optional tunnel Interface IA from ETS keyring
    // knxkeys_file_path: '/path/to/file.knxkeys', // (optional) path to .knxkeys file
    // knxkeys_password: 'projectpassword',        // (optional) ETS keyring password
    debug: true,               // Enable secure session debug logging
  }

  const knx = new SecureTunnelTCP(cfg)

  try {
    await knx.connect()

    console.log('\nTEST: ON/OFF 1/1/1 with status check 1/1/2')

    // ON
    await knx.sendCommand('1/1/1', true)
    const onVal = await knx.readStatus('1/1/2')
    console.log(`Status after ON: ${onVal ? 'ON' : 'OFF'}`)
    if (onVal !== 1) throw new Error('Unexpected status after ON (expected ON)')

    // OFF
    await knx.sendCommand('1/1/1', false)
    const offVal = await knx.readStatus('1/1/2')
    console.log(`Status after OFF: ${offVal ? 'ON' : 'OFF'}`)
    if (offVal !== 0) throw new Error('Unexpected status after OFF (expected OFF)')

    console.log('\nCommands sent and status verified correctly.')
    console.log('Waiting 5s before closing the connection (KNX spec).')
    await new Promise((r) => setTimeout(r, 5000))
  } catch (err) {
    console.error('\nError:', err)
  } finally {
    knx.disconnect()
  }
}

main().catch(console.error)
