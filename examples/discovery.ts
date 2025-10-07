/**
 * Example performing KNX interface discovery.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { KNXClient } from '../src'

async function main() {
  // Optional args: iface and timeout
  const ifaceArg = process.argv[2]
  const timeout = Number(process.argv[3] || 5000)

  // Trigger classic discovery; returns an array of descriptor strings
  const list = await KNXClient.discover(
    ifaceArg ? (ifaceArg as any) : undefined,
    timeout,
  )
  // Print each entry for quick inspection
  console.log(list)
}

main().catch(console.error)
