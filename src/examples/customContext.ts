import {
  Logger,
  ConsoleLogWriter,
  ConsoleLogWriterConfig,
  ConsoleLogWriterParam,
  Layout,
  LogEvent,
} from '..'

import { configure_process } from './configure_process'

// attach process event listeners and run 2 seconds before sending SIGINT
// see function configurations to see how process events can be handled
configure_process(2)

type LoggerArgs = any[]
type LoggerReturn = any
type LogWriterParam = ConsoleLogWriterParam
type LogWriterConfig = ConsoleLogWriterConfig
type LoggerContext = { label: string }

const LOGGER_NAME = 'Test Logger'

class SampleLogger extends Logger<LoggerArgs, LoggerContext, LoggerReturn> {
  getLogData(...args: LoggerArgs): LoggerReturn {
    return args
  }
}

const logger1 = new SampleLogger({
  loggerName: LOGGER_NAME,
  level: 'INFO',
  context: { label: 'Context 1' },
})

const logger2 = new SampleLogger({
  loggerName: LOGGER_NAME,
  level: 'INFO',
  context: { label: 'Context 2' },
})

const writer = new ConsoleLogWriter<LogWriterParam>('Writer Name')

class ConsoleLogLayout extends Layout<
  LoggerReturn,
  LogWriterParam,
  LoggerContext,
  LogWriterConfig
> {
  format(event: LogEvent<LoggerReturn, LoggerContext>): LogWriterParam {
    const { data, startTime, context } = event
    return [{ loggerName: this.loggerName, data, startTime, context }]
  }
}

writer.register<LoggerContext, LoggerReturn>(LOGGER_NAME, 'INFO', ConsoleLogLayout)

logger1.info('test1')
logger2.info('test2')
logger1.info('test3')
