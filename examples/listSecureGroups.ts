/**
 * Example listing Secure Group addresses from the keyring.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { Keyring } from '../src/secure/keyring'

async function main() {
  const path = './documents/Secure Test.knxkeys'
  const password = 'passwordprogetto'
  const kr = new Keyring()
  await kr.load(path, password)
  console.log('Secure group addresses in keyring:')
  for (const [ga, info] of kr.getGroupAddresses()) {
    const hasKey = info.decryptedKey ? 'yes' : 'no'
    console.log(`- ${ga} (key: ${hasKey})`)
  }
  console.log('\nInterfaces in keyring:')
  for (const [ia, i] of kr.getInterfaces()) {
    console.log(`- ${ia} (userId:${i.userId ?? 'n/a'})`)
    if (i.groupAddresses && i.groupAddresses.size > 0) {
      for (const [ga, senders] of i.groupAddresses) {
        const list = (senders || []).map((s) => s.toString()).join(', ')
        console.log(`   GA ${ga} senders: [${list}]`)
      }
    }
  }
}

main().catch((e) => {
  console.error('Error:', e)
  process.exit(1)
})
