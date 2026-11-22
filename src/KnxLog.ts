/**
 * Centralized logging utility for KNXUltimate.
 *
 * Written in Italy with love, sun and passion, by Massimo Saccani.
 *
 * Released under the MIT License.
 * Use at your own risk; the author assumes no liability for damages.
 */

import winston, { Container, Logform, Logger, transport } from 'winston'
import { PassThrough } from 'stream'

const { format, transports, addColors } = winston
const { combine, timestamp, label, printf, colorize, splat } = format

const colorizer = colorize()

const MODULES = process.env.LOG_MODULES
	? process.env.LOG_MODULES.split(',').map((m) => m.trim().toUpperCase())
	: null

export const logStream = new PassThrough({ objectMode: true })

/**
 * Maximum number of log entries kept in logStream's buffers. When a reader is
 * attached but does not consume (e.g. paused), newer entries are dropped
 * instead of growing the heap without bound.
 */
export const LOG_STREAM_MAX_BUFFERED = 1000

/**
 * Lets an entry through to logStream only when someone is reading it and the
 * buffer is below LOG_STREAM_MAX_BUFFERED. Without a reader a PassThrough
 * never drains, so every log line would be kept in memory forever.
 * pipe() and on('data') add a 'data' listener, async iteration adds 'readable'.
 */
const logStreamGate = format((info) => {
	if (
		logStream.listenerCount('data') === 0 &&
		logStream.listenerCount('readable') === 0
	)
		return false
	if (
		logStream.readableLength + logStream.writableLength >=
		LOG_STREAM_MAX_BUFFERED
	)
		return false
	return info
})

export interface KNXLogger extends Logger {
	module: string
}

export interface KNXLoggerContainer extends winston.Container {
	loggers: Map<string, KNXLogger>
}

export type LogLevel = 'disable' | 'error' | 'warn' | 'info' | 'debug' | 'trace'

export type KNXLoggerOptions = {
	loglevel?: LogLevel
	setPrefix?: string
}

export function setLogLevel(level: LogLevel) {
	logContainer.loggers.forEach((logger) => {
		const transportsList = logger.transports

		transportsList.forEach((t) => {
			t.level = level
		})

		logger.configure({ level, transports: transportsList })
	})
}

// Custom colors
addColors({
	time: 'grey',
	module: 'bold',
})

export function customKNXFormat(moduleName: string): Logform.Format {
	return combine(
		splat(),
		timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
		format((info: winston.Logform.TransformableInfo) => {
			info.level = info.level.toUpperCase()
			return info
		})(),
		label({ label: moduleName.toUpperCase() }),
		colorize({ level: true }),
		printf((info: winston.Logform.TransformableInfo) => {
			info.timestamp = colorizer.colorize(
				'time',
				info.timestamp as string,
			)
			info.label = colorizer.colorize(
				'module',
				(info.label || '-') as string,
			)
			return `${info.timestamp} ${info.level} ${info.label}: ${info.message}${info.stack ? `\n${info.stack}` : ''}`
		}),
	)
}

const logModules = (moduleName: string): Logform.Format =>
	format((info) =>
		!MODULES || MODULES.find((c) => moduleName.toUpperCase().startsWith(c))
			? info
			: false,
	)()

export function customTransports(moduleName: string): transport[] {
	const formats = MODULES ? [logModules(moduleName)] : []
	formats.push(customKNXFormat(moduleName))

	const transportsList: transport[] = [
		new transports.Console({
			format: combine(...formats),
			level: process.env.LOG_LEVEL || 'info',
			stderrLevels: ['error'],
		}),
		new winston.transports.Stream({
			stream: logStream,
			format: combine(logStreamGate(), ...formats),
		}),
	]

	return transportsList
}

export function setupLogger(
	container: Container,
	moduleName: string,
): KNXLogger {
	const logger = container.add(moduleName) as KNXLogger
	logger.configure({
		transports: customTransports(moduleName),
	})
	logger.module = moduleName
	return logger
}

const logContainer = new winston.Container() as KNXLoggerContainer

export function module(moduleName: string): KNXLogger {
	return setupLogger(logContainer, moduleName)
}

export default logContainer.loggers
