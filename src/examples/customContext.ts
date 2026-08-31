import {
  Logger,
  ConsoleLogWriter,
  ConsoleLogWriterConfig,
  ConsoleLogWriterParam,
  Layout,
  LogEvent,
  BuildEventDataResult,
} from '..'

import { configure_process } from './configure_process'

// attach process event listeners and run 2 seconds before sending SIGINT
// see function configurations to see how process events can be handled
configure_process(2)

type LoggerArgs = any[]
type LoggerReturnData = any
type LogWriterParam = ConsoleLogWriterParam
type LogWriterConfig = ConsoleLogWriterConfig
type LoggerContext = { label: string }
type LoggerReturnContext = LoggerContext

const LOGGER_NAME = 'Test Logger'

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
  LoggerReturnData,
  LogWriterParam,
  LoggerReturnContext,
  LogWriterConfig
> {
  format(event: LogEvent<LoggerReturnData, LoggerReturnContext>): LogWriterParam {
    const { data, startTime, context } = event
    return [{ loggerName: this.loggerName, data, startTime, context }]
  }
}

const layout = new ConsoleLogLayout({
  loggerName: LOGGER_NAME,
  logWriterName: writer.name,
  logWriterConfig: writer.config,
})
writer.register<LoggerReturnContext, LoggerReturnData>(LOGGER_NAME, 'INFO', layout)

logger1.info('test1')
logger2.info('test2')
logger1.info('test3')
