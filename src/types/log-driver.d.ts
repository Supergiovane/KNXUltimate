declare module 'log-driver' {
	export type LogLevel = 'silent' | 'trace' | 'debug' | 'info' | 'warn' | 'error'

	export interface LogDriverOptions {
		level: LogLevel
		format: (level: LogLevel, msg: string, ...args: any[]) => string
		levels: LogLevel[]
	}

	export interface Logger {
		silent: (...args: any[]) => void
		trace: (...args: any[]) => void
		debug: (...args: any[]) => void
		info: (...args: any[]) => void
		warn: (...args: any[]) => void
		error: (...args: any[]) => void
		format: LogDriverOptions['format']
	}

	export default function factory(options: LogDriverOptions): Logger

	export const logger: Logger
}
