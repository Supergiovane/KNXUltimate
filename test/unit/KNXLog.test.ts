/**
 * Unit tests for KNX Log.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import {
	module as createLogger,
	setLogLevel,
	logStream,
	LOG_STREAM_MAX_BUFFERED,
} from '../../src/KnxLog'
import winston from 'winston'

describe('KNX Logger Functionality Tests', async () => {
	let originalEnv: NodeJS.ProcessEnv

	beforeEach(() => {
		originalEnv = { ...process.env }
	})

	afterEach(() => {
		process.env = originalEnv
	})

	it('should create logger with correct module name', () => {
		const logger = createLogger('TestLogger')
		assert.strictEqual(logger.module, 'TestLogger')
	})

	it('should set log level correctly', () => {
		const logger = createLogger('TestLogger')
		setLogLevel('error')
		assert.strictEqual(logger.level, 'error')
	})

	it('should apply log level to all loggers', () => {
		const logger1 = createLogger('Logger1')
		const logger2 = createLogger('Logger2')

		setLogLevel('error')
		setLogLevel('debug')

		assert.strictEqual(logger1.level, 'debug')
		assert.strictEqual(logger2.level, 'debug')
	})

	it('should use winston transport', () => {
		const logger = createLogger('TestLogger')
		const transports = logger.transports
		assert.ok(
			transports.some((t) => t instanceof winston.transports.Console),
		)
	})

	it('should handle error objects and format stack traces correctly', async () => {
		const logger = createLogger('TestLogger')
		const error = new Error('Test error')

		const data = await new Promise<any>((resolve) => {
			logStream.once('data', resolve)
			const prefixMessage = 'Error message'
			logger.error(prefixMessage, error)
		})

		const fullMessage = data[Symbol.for('message')]

		assert.ok(
			fullMessage.includes(error.message),
			'Should include error message',
		)
		assert.ok(
			fullMessage.includes('Error message'),
			'Should include custom message',
		)
		assert.ok(
			fullMessage.includes(error.stack!),
			'Should include full stack trace',
		)
		assert.ok(
			fullMessage.includes('\n'),
			'Stack trace should be on new line',
		)
	})

	it('should handle null and undefined values', () => {
		const logger = createLogger('TestLogger')
		assert.doesNotThrow(() => {
			logger.info(null)
			logger.info(undefined)
		})
	})

	it('should apply correct log level from environment variable', () => {
		process.env.LOG_LEVEL = 'debug'
		const logger = createLogger('EnvTestLogger')
		assert.strictEqual(logger.transports[0].level, 'debug')
	})

	describe('logStream memory bounds', () => {
		const settle = () =>
			new Promise<void>((r) => {
				setTimeout(r, 50)
			})
		const quietLogger = (name: string) => {
			const logger = createLogger(name)
			setLogLevel('warn')
			logger.transports[0].silent = true // keep Console quiet
			return logger
		}
		const buffered = () =>
			logStream.readableLength + logStream.writableLength

		it('does not buffer lines when nobody reads logStream', async () => {
			const logger = quietLogger('NoReader')
			assert.strictEqual(logStream.listenerCount('data'), 0)
			for (let i = 0; i < 500; i++) logger.warn('line %d', i)
			await settle()
			assert.strictEqual(buffered(), 0)
		})

		it('delivers lines once a reader is attached', async () => {
			const logger = quietLogger('WithReader')
			const received: any[] = []
			const onData = (d: any) => received.push(d)
			logStream.on('data', onData)
			for (let i = 0; i < 10; i++) logger.warn('line %d', i)
			await settle()
			logStream.off('data', onData)
			assert.strictEqual(received.length, 10)
		})

		it('caps the buffer when the reader stops consuming', async () => {
			const logger = quietLogger('PausedReader')
			const onData = () => {}
			logStream.on('data', onData)
			logStream.pause()
			for (let i = 0; i < LOG_STREAM_MAX_BUFFERED * 3; i++)
				logger.warn('line %d', i)
			await settle()
			const size = buffered()
			logStream.resume()
			await settle()
			logStream.off('data', onData)
			assert.ok(size > 0, 'some lines should be buffered')
			assert.ok(
				size <= LOG_STREAM_MAX_BUFFERED,
				`buffered ${size} > ${LOG_STREAM_MAX_BUFFERED}`,
			)
		})
	})
})
