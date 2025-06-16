/*
export DEBUG=log4ts:logWriter:file,log4ts:logWriter:shutdown,log4ts:configure_process
yarn run build && node ./dist/examples/file.js
*/

import { Logger, FileLogWriter } from '..'

import { configure_process } from './configure_process'

// attach process event listeners and run 2 seconds before sending SIGINT
// see function configurations to see how process events can be handled
configure_process(2)

/**
 * Defines logger args data type.
 * This type must extend array since it is used as `logger.log(args:)`
 *
 * @example
 * type LoggerData = [string | number]    // support only one arg of string | number
 * type LoggerData = (string | number)[]  // support any number of string | number args
 *
 * // This type is used to define logger functions as follows
 * logger.info = (...args: TData) => {logger.send(level, ...args)}
 */
type LoggerData = [string | number]

/*
logger.info('sample event')                   // OK
logger.info('sample event', 'another value')  // FAIL; must only have 1 argument
logger.info(true)                             // FAIL; must be string | number
*/

const logger = new Logger<LoggerData, never>({
  loggerName: 'fileLogger',
  level: 'DEBUG',
})

const fileWriter = new FileLogWriter('fileWriter', {
  filename: './logs/test.txt',
  backups: 3,
  maxLogSize: 1024, // size in bytes
  mode: 0o644,
})

// Data type for `fileWriter` and `logger` are used to infer
// data types for `event`, `logWriterName`, `_logWriterConfig`
fileWriter.attachToLogger(logger, 'DEBUG', (event, logWriterName, _logWriterConfig) => {
  return (
    `${event.payload.startTime.toISOString()} [${event.payload.level}] ` +
    `[logger: ${event.payload.loggerName}] [writer: ${logWriterName}]` +
    ` ${event.payload.data[0]} [context] ${JSON.stringify(event.payload.context) ?? '{}'}`
  )
})

logger.info('sample event')
