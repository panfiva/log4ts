/*
export DEBUG=log4ts:RollingFileWriteSyncStream
yarn run build && node ./dist/examples/fileSync.js
*/

import { Logger, FileLogWriterSync } from '..'

import { configure_process } from './configure_process'

// attach process event listeners and run 2 seconds before sending SIGINT
// see function configurations to see how process events can be handled
configure_process(2)

const logger = new Logger({
  loggerName: 'fileLogger',
  level: 'DEBUG',
})

const fileWriter = new FileLogWriterSync('fileWriter', {
  filename: './logs/test.txt',
  backups: 1,
  maxLogSize: 20, // size in bytes
  mode: 0o644,
})

fileWriter.register(logger, 'DEBUG', (event, logWriterName, _logWriterConfig) => {
  return (
    `${event.startTime.toISOString()} [${event.level}] ` +
    `[logger: ${event.loggerName}] [context] ${JSON.stringify(event.context) ?? '{}'} ` +
    `[writer: ${logWriterName}] ${event.data[0]} `
  )
})

logger.info('sample event')
