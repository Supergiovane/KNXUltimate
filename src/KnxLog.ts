/**
 * (C) 2021 Supergiovane
 */

import util from 'util'
// import factory, { Logger, LogLevel, LogDriverOptions } from 'log-driver'
let clog = require('node-color-log')

const possibleLevels: string[] = ['disable', 'error', 'warn', 'info', 'debug']

export type KNXLoggerOptions = {
	/** The log level to use */
	loglevel?: string
	/** Set it to true to enable max log level */
	debug?: boolean
	setPrefix?: string
}

/*
 * Logger-Level importance levels:
 *  trace < info < warn < error
 */

const determineLogLevel = (options: KNXLoggerOptions): string => {
	let level: string

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
	get: (options?: KNXLoggerOptions) => any
	destroy: () => void
}

const KnxLog: KnxLogger = {
	get: (options) => {
		if (!options && clog) return clog
		clog = clog.createNamedLogger(options.setPrefix || 'KNXEngine')
		if (options.loglevel === undefined) options.loglevel = 'error'
		if (options.loglevel === 'silent') options.loglevel = 'disable'
		if (options.loglevel === 'trace') options.loglevel = 'debug'
		clog.setLevel(options.loglevel)
		clog.setDate(() => new Date().toLocaleString())
		return clog
	},
	destroy: () => {
		// 16/08/2020 Supergiovane Destruction of the logger
		clog = null
	},
}

export default KnxLog
