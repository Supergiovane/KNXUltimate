/**
 * Internal example validating KNX datetime handling (DPT 19.001).
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { dptlib } from '../src'

async function main() {
  const dpt = dptlib.resolve('19.001')

  // Simulate receiving a KNX telegram encoded as DPT 19.001 (date + time)
  const incomingPayload = Buffer.from([126, 5, 18, 44, 30, 45, 0, 0]) // 2026-05-18 12:30:45
  const decoded = dptlib.fromBuffer(incomingPayload, dpt)
  console.log('Decoded 19.001 ->', decoded)

  // Simulate encoding date/time values to KNX payload
  const values: Array<Date | string | number> = [
    new Date('2026-05-18T12:30:00'),
    '2026-05-18T12:30:00',
    Date.now(),
  ]

  values.forEach((value) => {
    const apdu = dpt.formatAPDU?.(value)
    console.log('Encoded 19.001 from', value, '->', apdu)
  })
}

main().catch(console.error)
