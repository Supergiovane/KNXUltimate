import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import {
	module as createLogger,
	setLogLevel,
	logStream,
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
			logger.error('Error message', error)
		})

		const fullMessage = data[Symbol.for('message')]

		assert.ok(
			fullMessage.includes('Test error'),
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
})
