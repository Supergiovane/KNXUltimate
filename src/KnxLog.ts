import winston, { Container, Logform, Logger, transport } from 'winston'
import { PassThrough } from 'stream'

const { format, transports, addColors } = winston
const { combine, timestamp, label, printf, colorize, splat } = format

const colorizer = colorize()

const MODULES = process.env.LOG_MODULES
	? process.env.LOG_MODULES.split(',').map((m) => m.trim().toUpperCase())
	: null

export const logStream = new PassThrough({ objectMode: true })

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
		logger.level = level
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
			format: combine(...formats),
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
