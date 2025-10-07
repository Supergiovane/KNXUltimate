/**
 * Example showing basic KNX datapoint encoding and decoding helpers.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { dptlib } from '../src'

function logBooleanSample() {
  // DPT 1.001 represents a simple boolean (on/off)
  const config = dptlib.resolve('1.001')
  const apdu = config.formatAPDU?.(true)
  if (!apdu) {
    console.log('DPT 1.001 cannot be encoded in this environment.')
    return
  }
  const decoded = dptlib.fromBuffer(apdu, config)
  console.log('1.001 true ->', apdu.toString('hex'), '->', decoded)
}

function logTemperatureSample() {
  // DPT 9.001 encodes temperatures in °C using a 2-byte float
  const config = dptlib.resolve('9.001')
  const apdu = config.formatAPDU?.(21.5)
  if (!apdu) {
    console.log('DPT 9.001 cannot be encoded in this environment.')
    return
  }
  const decoded = dptlib.fromBuffer(apdu, config)
  console.log('9.001 21.5°C ->', apdu.toString('hex'), '->', decoded)
}

function logHueSample() {
  // DPT 232.600 stores RGB colours as three bytes (red, green, blue)
  const config = dptlib.resolve('232.600')
  const apdu = config.formatAPDU?.({ red: 128, green: 64, blue: 255 })
  if (!apdu) {
    console.log('DPT 232.600 cannot be encoded in this environment.')
    return
  }
  const decoded = dptlib.fromBuffer(apdu, config)
  console.log('232.600 RGB sample ->', apdu.toString('hex'), '->', decoded)
}

// Emit a few representative conversions
logBooleanSample()
logTemperatureSample()
logHueSample()
