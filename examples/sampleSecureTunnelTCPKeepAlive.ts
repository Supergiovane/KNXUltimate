import KNXClient, { SecureConfig } from '../src/KNXClient'

function now() {
  return new Date().toISOString()
}

async function main() {
  // KNX Secure + Data Secure configuration (adjust to your environment)
  const secureCfg: SecureConfig = {
    tunnelInterfaceIndividualAddress: '1.1.254',
    knxkeys_file_path:
      '/Users/massimosaccani/Documents/GitHub/KNXUltimate/documents/Secure Test.knxkeys',
    knxkeys_password: 'passwordprogetto',
  }

  // To use manual credentials instead of the ETS keyring:
  // const secureCfg: SecureConfig = {
  //   tunnelInterfaceIndividualAddress: '1.1.254',
  //   tunnelUserPassword: 'passwordtunnel1',
  //   tunnelUserId: 2,
  // }

  const client = new KNXClient({
    hostProtocol: 'TunnelTCP',
    ipAddr: '192.168.1.4',
    ipPort: 3671,
    isSecureKNXEnabled: true,
    secureTunnelConfig: secureCfg,
    loglevel: 'debug',
  })

  client.on('connecting', () =>
    console.log(`[${now()}] Connecting to ${'192.168.1.4:3671'} (secure TCP)`),
  )
  client.on('connected', () =>
    console.log(`[${now()}] ✓ KNXClient connected (secure TCP)`),
  )
  client.on('disconnected', (reason: string) =>
    console.warn(`[${now()}] ✗ Disconnected: ${reason}`),
  )
  client.on('error', (e: Error) =>
    console.error(`[${now()}] Error: ${e?.message || e}`),
  )
  client.on('close', () =>
    console.log(`[${now()}] Socket closed`),
  )

  // Start and keep the connection open
  client.Connect()
  await new Promise<void>((resolve) => client.once('connected', () => resolve()))

  console.log(
    `\n[${now()}] Connection is open and heartbeat is running. Press Ctrl+C to exit.`,
  )

  // Keep the process alive indefinitely to observe disconnections
  // (the client heartbeat runs in the background)
  process.on('SIGINT', async () => {
    console.log(`\n[${now()}] Caught SIGINT. Disconnecting...`)
    try {
      await client.Disconnect()
    } finally {
      process.exit(0)
    }
  })
  process.on('SIGTERM', async () => {
    console.log(`\n[${now()}] Caught SIGTERM. Disconnecting...`)
    try {
      await client.Disconnect()
    } finally {
      process.exit(0)
    }
  })

  // Prevent process exit
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  await new Promise<void>(() => {})
}

main().catch((e) => {
  console.error(`[${now()}] Fatal:`, e)
  process.exit(1)
})
