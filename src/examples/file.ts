import {
  Layout,
  Logger,
  FileLogWriter,
  FileLogWriterConfig,
  FileLogWriterParam,
  LogEvent,
  BuildEventDataResult,
} from '..'

import { configure_process } from './configure_process'

// attach process event listeners and run 2 seconds before sending SIGINT
// see function configurations to see how process events can be handled
configure_process(2)

/** one one parameter will be accepted in logger functions */
type LoggerArgs = [string | number]
type LoggerReturnData = [string | number]
type LogWriterParam = FileLogWriterParam
type LogWriterConfig = FileLogWriterConfig
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
  loggerName: 'fileLogger',
  level: 'DEBUG',
})

const fileWriter = new FileLogWriter('fileWriter', {
  filename: './logs/test.txt',
  backups: 3,
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
