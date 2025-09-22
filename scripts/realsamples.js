#!/usr/bin/env node
/*
 * Runs the real samples sequentially with a 5s pause between each.
 * Uses esbuild-register to execute TypeScript examples without transpiling.
 */
const { spawn } = require('child_process')
const path = require('path')

const samples = [
  path.resolve(__dirname, '..', 'examples', 'samplePlainMulticast.ts'),
  path.resolve(__dirname, '..', 'examples', 'samplePlainTunnelUPD.ts'),
  path.resolve(__dirname, '..', 'examples', 'sampleSecureMulticast.ts'),
  path.resolve(__dirname, '..', 'examples', 'sampleSecureTunnelTCP.ts'),
  path.resolve(
    __dirname,
    '..',
    'examples',
    'sampleSecureTunnelTCPNoDataSecure.ts',
  ),
]

function wait(ms) {
  return new Promise((res) => setTimeout(res, ms))
}

async function runOne(file) {
  return new Promise((resolve, reject) => {
    const code = `require(${JSON.stringify(file)})`
    const child = spawn(
      process.execPath,
      ['-r', 'esbuild-register', '-e', code],
      { stdio: 'inherit' },
    )
    child.on('exit', (code) => {
      if (code === 0) return resolve()
      reject(new Error(`Sample failed: ${file} (exit ${code})`))
    })
    child.on('error', reject)
  })
}

; (async () => {
  for (let i = 0; i < samples.length; i++) {
    const f = samples[i]
    console.log(`\n\n\n\n\n\n\n=== Running sample ${i + 1}/${samples.length}: ${f} ===`)
    await runOne(f)
    if (i < samples.length - 1) {
      console.log('Waiting 5s before next sample...')
      await wait(5000)
    }
  }
  console.log('\nAll samples completed.')
})().catch((err) => {
  console.error('\nError while running samples:', err && err.message ? err.message : err)
  process.exit(1)
})
