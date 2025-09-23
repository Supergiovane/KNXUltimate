/**
 * Example listing KNX interfaces with a concise summary.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { KNXClient } from '../src'

async function main() {
// Optional CLI arguments: local interface name and discover timeout in ms
const ifaceArg = process.argv[2]
const timeoutArg = Number(process.argv[3] ?? 4000)
const iface = ifaceArg && ifaceArg.trim().length > 0 ? ifaceArg : undefined
const timeout = Number.isFinite(timeoutArg) ? timeoutArg : 4000

// Ask the helper to search for tunnelling/routing endpoints
const interfaces = await KNXClient.discoverInterfaces(iface as any, timeout)

if (interfaces.length === 0) {
  console.log('No KNX/IP interfaces found. Try increasing the timeout or specifying a local interface.')
  return
  }

  for (const entry of interfaces) {
    // Derive human-readable fields and print a compact summary
    const label = entry.name || '(unnamed gateway)'
    const services = entry.services.length > 0 ? entry.services.join(', ') : 'none'
    const ia = entry.ia || 'n/a'
    console.log(
      `[${entry.type}] ${label} @ ${entry.ip}:${entry.port} via ${entry.transport} ` +
        `(IA ${ia}) services: ${services}`,
    )
  }
}

main().catch((error) => {
  console.error('Discovery failed:', error)
  process.exitCode = 1
})
