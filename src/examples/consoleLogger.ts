import { configure_process } from './configure_process'

configure_process(5)

import {
  Logger,
  ConsoleLogWriter,
  ConsoleLogWriterConfig,
  ConsoleLogWriterParam,
  Layout,
  LogEvent,
  BuildEventDataResult,
} from '..'
import { formatWithOptions, styleText } from 'node:util'

type LoggerArgs = [string | number | boolean, Record<string, any>]
type LoggerReturnData = [string | number | boolean, Record<string, any>]
type LogWriterParam = ConsoleLogWriterParam
type LogWriterConfig = ConsoleLogWriterConfig
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
  loggerName: 'console-logger',
  level: 'TRACE',
  context: {},
})

class ConsoleLogLayout extends Layout<
  LoggerReturnData,
  LogWriterParam,
  LoggerReturnContext,
  LogWriterConfig
> {
  format(event: LogEvent<LoggerReturnData, LoggerReturnContext>): LogWriterParam {
    const data = [...event.data]

    const objectColors: boolean = true
    const colorBySev: boolean = true
    const depth: number | null = 3
    const out: string[] = []
    for (const v of data) {
      const v2 = typeof v === 'number' || typeof v === 'boolean' ? v.toString() : v
      const isSevColor = colorBySev && typeof v2 === 'string'
      let str = formatWithOptions({ colors: objectColors, depth, compact: true }, v2)
      if (isSevColor) str = styleText(event.level.color, str)
      out.push(str)
    }

    return out
  }
}

const writer = new ConsoleLogWriter<LogWriterParam>('console-writer')
const layout = new ConsoleLogLayout({
  loggerName: logger.loggerName,
  logWriterName: writer.name,
  logWriterConfig: writer.config,
})

writer.register<LoggerReturnContext, LoggerReturnData>(logger.loggerName, 'TRACE', layout)

const obj = { a: { b: { c: [1, 2, 3, 4], e: { f: [1, 2, 3, 4] } } } }

logger.trace('TRACE event', obj)
logger.debug('DEBUG event', obj)
logger.info('INFO event', obj)
logger.warn('WARN event', obj)
logger.error('ERROR event', obj)
logger.fatal('FATAL event', obj)
