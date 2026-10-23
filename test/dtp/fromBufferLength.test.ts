/**
 * Validates that decoding a payload of the wrong length for the DPT
 * returns null without logging above debug level.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { dpts } from '../../src/dptlib'
import { logStream, setLogLevel } from '../../src/KnxLog'

// Variable-length DPTs (strings, raw hex) accept any size
const variableLength = ['DPT4', 'DPT16', 'DPT24', 'DPT28', 'DPT999']

describe('dptlib fromBuffer with a wrong payload length', () => {
	const logged: string[] = []
	const onLog = (info: { level: string; message: string }) => {
		// eslint-disable-next-line no-control-regex
		const level = String(info.level).replace(/\x1b\[\d+m/g, '')
		if (/^(warn|error)$/i.test(level)) logged.push(info.message)
	}

	before(() => {
		setLogLevel('info')
		logStream.on('data', onLog)
	})

	after(() => {
		logStream.off('data', onLog)
	})

	Object.entries(dpts)
		.filter(([, config]) => typeof config.fromBuffer === 'function')
		.forEach(([id, config]) => {
			const lengths = variableLength.includes(id) ? [] : [0, 20]
			lengths.forEach((length) => {
				test(`${id} returns null for ${length} bytes, logging at debug only`, () => {
					logged.length = 0
					assert.equal(config.fromBuffer(Buffer.alloc(length)), null)
					assert.deepEqual(logged, [])
				})
			})
		})
})
