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

/** first logger input - one string arg */
type LoggerArgs_1 = [string]

/** second logger input - one record arg */
type LoggerArgs_2 = [{ data: string; type: 't1' | 't2' }]

/** both loggers must return the same data */
type LoggerReturnData = string

type LogWriterParam = ConsoleLogWriterParam
type LogWriterConfig = ConsoleLogWriterConfig
type LoggerContext = any
type LoggerReturnContext = any

class Logger1 extends Logger<LoggerArgs_1, LoggerContext, LoggerReturnData, LoggerReturnContext> {
  // this logger accepts one parameter - string
  // no transformation is needed
  buildEventPayload(
    ...args: LoggerArgs_1
  ): BuildEventDataResult<LoggerReturnData, LoggerReturnContext> {
    return {
      data: args[0],
      context: this.context,
      error: this.getFirstError(...args),
    }
  }
}

class Logger2 extends Logger<LoggerArgs_2, LoggerContext, LoggerReturnData, LoggerReturnContext> {
  // this logger accepts one parameter - object
  // so we convert this object to string and return it
  // this will make return consistent with Logger1's return
  buildEventPayload(
    ...args: LoggerArgs_2
  ): BuildEventDataResult<LoggerReturnData, LoggerReturnContext> {
    return {
      data: JSON.stringify(args[0]),
      context: this.context,
      error: this.getFirstError(...args),
    }
  }
}

const LOGGER_NAME = 'Logger Name'

const logger1 = new Logger1({ loggerName: LOGGER_NAME, level: 'INFO' })
const logger2 = new Logger2({ loggerName: LOGGER_NAME, level: 'INFO' })

class ConsoleLogLayout extends Layout<
  LoggerReturnData,
  LogWriterParam,
  LoggerReturnContext,
  LogWriterConfig
> {
  format(event: LogEvent<LoggerReturnData, LoggerReturnContext>): LogWriterParam {
    return [event.data]
  }
}

const writer = new ConsoleLogWriter('console-writer')
const layout = new ConsoleLogLayout({
  loggerName: LOGGER_NAME,
  logWriterName: writer.name,
  logWriterConfig: writer.config,
})

writer.register(LOGGER_NAME, 'INFO', layout)

logger1.info('test1')
logger2.info({ data: 'test2', type: 't2' })
