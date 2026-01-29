import {
  Layout,
  Logger,
  FileLogWriter,
  FileLogWriterConfig,
  FileLogWriterParam,
  LogEvent,
} from '..'

import { configure_process } from './configure_process'

// attach process event listeners and run 2 seconds before sending SIGINT
// see function configurations to see how process events can be handled
configure_process(2)

/** one one parameter will be accepted in logger functions */
type LoggerArgs = [string | number]
type LoggerReturn = [string | number]
type LogWriterParam = FileLogWriterParam
type LogWriterConfig = FileLogWriterConfig
type LoggerContext = never

class SampleLogger extends Logger<LoggerArgs, LoggerContext, LoggerReturn> {
  getLogData(...args: LoggerArgs): LoggerReturn {
    return args
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

class SampleLayout extends Layout<LoggerReturn, LogWriterParam, LoggerContext, LogWriterConfig> {
  format(event: LogEvent<LoggerReturn, LoggerContext>): LogWriterParam {
    return (
      `${event.startTime.toISOString()} [${event.level}] ` +
      `[logger: ${event.loggerName}] [writer: ${this.logWriterName}]` +
      ` ${event.data[0]} [context] ${JSON.stringify(event.context) ?? '{}'}`
    )
  }
}

fileWriter.register(logger.loggerName, 'DEBUG', SampleLayout)

logger.info('sample event')
