// clear && yarn run build && DEBUG="log4ts:logWriter:file,log4ts:configure_process"  node ./dist/examples/file.js

import { Logger, FileLogWriter } from '..'

import { configure_process } from './configure_process'

// attach process event listeners and run 30 seconds
configure_process(30)

// send SIGINT after 2 seconds to demostrate event handlers
// see configure_process
setTimeout(() => {
  process.kill(process.pid, 'SIGINT')
}, 2 * 1000)

// Logger will only accept one parameter
type LoggerData = [string | number]

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

fileWriter.attachToLogger(logger, 'DEBUG', (event, logWriterName, _logWriterConfig) => {
  return (
    `${event.payload.startTime.toISOString()} [${event.payload.level}] [logger: ${event.payload.loggerName}] [writer: ${logWriterName}]` +
    ` ${event.payload.data[0]} [context] ${JSON.stringify(event.payload.context) ?? '{}'}`
  )
})

logger.info('sample event')
