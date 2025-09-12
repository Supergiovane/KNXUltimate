import { KNXClient } from '../src'

async function main() {
  // Optional args: iface and timeout
  const ifaceArg = process.argv[2]
  const timeout = Number(process.argv[3] || 5000)

  const list = await KNXClient.discover(
    ifaceArg ? (ifaceArg as any) : undefined,
    timeout,
  )
  console.log(list)
}

main().catch(console.error)
