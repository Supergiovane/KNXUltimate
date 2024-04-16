/**
* (C) 2021 Supergiovane
*/
'use strict'

import util from 'util';
import factory, { Logger, LogLevel } from 'log-driver'

const possibleLevels: LogLevel[] = ['silent', 'error', 'warn', 'info', 'debug', 'trace'];
let logger: Logger;

/*
 * Logger-Level importance levels:
 *  trace < info < warn < error
 */

const determineLogLevel = (options: { loglevel?: LogLevel, debug?: boolean }): LogLevel => {
  let level: LogLevel;

  // 24/03/2021 Supergiovane fixed logLevel capitalization to lowercase
  if (options) {
    if (options.loglevel) {
      level = options.loglevel;
    } else {
      options.debug ? level = 'debug' : level = 'info';
    }
  } else {
    level = 'info';
  }
  if (!possibleLevels.includes(level)) level = 'error';
  return level;
}

export interface KnxLogger {
	get: (options?: KnxLogOptions) => Logger
  destroy: () => void
}

const KnxLog: KnxLogger = {
  get: (options) => {
    if ((!logger) || (logger && options)) {
      logger = factory({
        levels: possibleLevels,
        level: determineLogLevel(options),
        format: function () {
          // arguments[0] is the log level ie 'debug'
          const a = Array.from(arguments);
          let ts: string;
          const dt = new Date();
          try {
            ts = dt.toLocaleString().replace(/T/, ' ').replace(/Z$/, '') + '.' + dt.getMilliseconds() + ' KNXUltimate-KNXEngine:';
          } catch (error) {
            ts = dt.toISOString().replace(/T/, ' ').replace(/Z$/, '') + '.' + dt.getMilliseconds() + ' KNXUltimate-KNXEngine:';
          }

          if (a.length > 2) {
            // if more than one item to log, assume a fmt string is given
            const fmtargs = ['[%s] %s ' + a[1], a[0], ts].concat(a.slice(2));
            return util.format.apply(util, fmtargs);
          } else {
            // arguments[1] is a plain string
            return util.format('[%s] %s %s', a[0], ts, a[1]);
          }
        }
      });
    }
    return (logger);
  },
  destroy: ()=> {
    // 16/08/2020 Supergiovane Destruction of the logger
    logger = null;
  }
}

export default KnxLog