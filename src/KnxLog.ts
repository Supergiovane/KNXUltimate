/**
 * (C) 2021 Supergiovane
 */

import util from 'util'
import factory, { Logger, LogLevel, LogDriverOptions } from 'log-driver'

const possibleLevels: LogLevel[] = [
	'silent',
	'error',
	'warn',
	'info',
	'debug',
	'trace',
]
let logger: Logger

export type KNXLoggerOptions = {
	/** The log level to use */
	loglevel?: LogLevel
	/** Set it to true to enable max log level */
	debug?: boolean
}

/*
 * Logger-Level importance levels:
 *  trace < info < warn < error
 */

const determineLogLevel = (options: KNXLoggerOptions): LogLevel => {
	let level: LogLevel

	// 24/03/2021 Supergiovane fixed logLevel capitalization to lowercase
	if (options) {
		if (options.loglevel) {
			level = options.loglevel
		} else if (options.debug) {
			level = 'debug'
		} else {
			level = 'info'
		}
	} else {
		level = 'info'
	}
	if (!possibleLevels.includes(level)) level = 'error'
	return level
}

export interface KnxLogger {
	get: (options?: KNXLoggerOptions) => Logger
	destroy: () => void
}

const KnxLog: KnxLogger = {
	get: (options) => {
		if (!logger || (logger && options)) {
			logger = factory({
				levels: possibleLevels,
				level: determineLogLevel(options),
				format(...args) {
					// arguments[0] is the log level ie 'debug'
					let ts: string
					const dt = new Date()
					try {
						ts = `${dt
							.toLocaleString()
							.replace(/T/, ' ')
							.replace(
								/Z$/,
								'',
							)}.${dt.getMilliseconds()} KNXUltimate-KNXEngine:`
					} catch (error) {
						ts = `${dt
							.toISOString()
							.replace(/T/, ' ')
							.replace(
								/Z$/,
								'',
							)}.${dt.getMilliseconds()} KNXUltimate-KNXEngine:`
					}

					if (args.length > 2) {
						// if more than one item to log, assume a fmt string is given
						const fmtargs = [
							`[%s] %s ${args[1]}`,
							args[0],
							ts,
						].concat(args.slice(2))
						return util.format(...fmtargs)
					}
					// arguments[1] is a plain string
					return util.format('[%s] %s %s', args[0], ts, args[1])
				},
			})
		}
		return logger
	},
	destroy: () => {
		// 16/08/2020 Supergiovane Destruction of the logger
		logger = null
	},
}

export default KnxLog
