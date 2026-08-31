/*
export DEBUG=log4ts:RollingFileWriteSyncStream
yarn run build && node ./dist/examples/fileSync.js
*/

import {
  LogEvent,
  Layout,
  Logger,
  FileLogWriterSync,
  FileLogWriterSyncConfig,
  FileLogWriterSyncParam,
  BuildEventDataResult,
} from '..'

import { configure_process } from './configure_process'

// attach process event listeners and run 2 seconds before sending SIGINT
// see function configurations to see how process events can be handled
configure_process(2)

/** one one parameter will be accepted in logger functions */
type LoggerArgs = [string | number]
type LoggerReturnData = [string | number]
type LogWriterParam = FileLogWriterSyncParam
type LogWriterConfig = FileLogWriterSyncConfig
type LoggerContext = any
type LoggerReturnContext = any

class SampleLogger extends Logger<
  LoggerArgs,
  LoggerContext,
  LoggerReturnData,
  LoggerReturnContext
> {
  buildEventPayload(
    ...args: LoggerArgs
  ): BuildEventDataResult<LoggerReturnData, LoggerReturnContext> {
    return {
      data: args,
      context: this.context,
      error: this.getFirstError(...args),
    }
  }
}

const logger = new SampleLogger({
  loggerName: 'fileLogger-sync',
  level: 'DEBUG',
})

const fileWriter = new FileLogWriterSync('fileWriter-sync', {
  filename: './logs/test.txt',
  backups: 1,
  maxLogSize: 1024, // size in bytes
  mode: 0o644,
})

class SampleLayout extends Layout<
  LoggerReturnData,
  LogWriterParam,
  LoggerReturnContext,
  LogWriterConfig
> {
  format(event: LogEvent<LoggerReturnData, LoggerReturnContext>): LogWriterParam {
    return (
      `${event.startTime.toISOString()} [${event.level}] ` +
      `[logger: ${event.loggerName}] [writer: ${this.logWriterName}]` +
      ` ${event.data[0]} [context] ${JSON.stringify(event.context) ?? '{}'}`
    )
  }
}

const layout = new SampleLayout({
  loggerName: logger.loggerName,
  logWriterName: fileWriter.name,
  logWriterConfig: fileWriter.config,
})
fileWriter.register(logger.loggerName, 'DEBUG', layout)

logger.info('sample event')
