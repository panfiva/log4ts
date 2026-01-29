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

/** first logger input - one string arg */
type LoggerArgs_1 = [string]

/** second logger input - one record arg */
type LoggerArgs_2 = [{ data: string; type: 't1' | 't2' }]

/** both loggers must return the same data */
type LoggerReturn = string

type LogWriterParam = ConsoleLogWriterParam
type LogWriterConfig = ConsoleLogWriterConfig
type LoggerContext = never

class Logger1 extends Logger<LoggerArgs_1, LoggerContext, LoggerReturn> {
  // this logger accepts one parameter - string
  // no transformation is needed
  getLogData(...args: LoggerArgs_1): LoggerReturn {
    return args[0]
  }
}

class Logger2 extends Logger<LoggerArgs_2, LoggerContext, LoggerReturn> {
  // this logger accepts one parameter - object
  // so we convert this object to string and return it
  // this will make return consistent with Logger1's return
  getLogData(...args: LoggerArgs_2): LoggerReturn {
    return JSON.stringify(args[0])
  }
}

const LOGGER_NAME = 'Logger Name'

const logger1 = new Logger1({ loggerName: LOGGER_NAME, level: 'INFO' })
const logger2 = new Logger2({ loggerName: LOGGER_NAME, level: 'INFO' })

class ConsoleLogLayout extends Layout<
  LoggerReturn,
  LogWriterParam,
  LoggerContext,
  LogWriterConfig
> {
  format(event: LogEvent<LoggerReturn, LoggerContext>): LogWriterParam {
    return [event.data]
  }
}

const writer = new ConsoleLogWriter('console-writer')

writer.register(LOGGER_NAME, 'INFO', ConsoleLogLayout)

logger1.info('test1')
logger2.info({ data: 'test2', type: 't2' })
