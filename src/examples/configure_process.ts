import debugLib from 'debug'
const debug = debugLib('log4ts:configure_process')

import {
  Logger,
  ConsoleLogWriter,
  shutdown,
  Layout,
  LogEvent,
  ConsoleLogWriterConfig,
  ConsoleLogWriterParam,
  BuildEventDataResult,
} from '..'

type Seconds = number

type LoggerArgs = any
type LoggerReturnData = any
type LogWriterParam = ConsoleLogWriterParam
type LogWriterConfig = ConsoleLogWriterConfig
type LoggerContext = any
type LoggerReturnContext = any

class ProcessLogger extends Logger<
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

const logger = new ProcessLogger({
  level: 'DEBUG',
  loggerName: 'node_process_logger',
  useCallStack: false,
  context: {},
})

class Layout_Console extends Layout<
  LoggerReturnData,
  LogWriterParam,
  LoggerContext,
  LogWriterConfig
> {
  format(event: LogEvent<LoggerArgs, LoggerContext>): LogWriterParam {
    return [`[node_process_writer]:`, event.startTime, `[${event.level.levelName}]`, ...event.data]
  }
}

const logWriter = new ConsoleLogWriter<LoggerArgs>('node_process_writer')

export const configure_process = (/** duration in seconds before exit */ duration?: Seconds) => {
  const layout = new Layout_Console({
    loggerName: logger.loggerName,
    logWriterName: logWriter.name,
    logWriterConfig: logWriter.config,
  })
  logWriter.register(logger.loggerName, 'DEBUG', layout)

  const process_signal_handler = (
    reason: 'SIGINT' | 'SIGTERM' | 'uncaughtException' | 'unhandledRejection'
  ) => {
    if (['uncaughtException', 'unhandledRejection'].includes(reason)) {
      logger.fatal(`exit signal: ${reason}`)
    } else {
      logger.info(`exit signal: ${reason}`)
    }

    shutdown(() => {
      process.exit(1)
    })
  }

  process.on('SIGINT', () => {
    debug(`received 'SIGINT' signal`)
    return process_signal_handler('SIGINT')
  })

  process.on('SIGTERM', () => {
    debug(`received 'SIGTERM' signal`)
    return process_signal_handler('SIGTERM')
  })

  process.on('unhandledRejection', (reason: Error) => {
    debug('process.on.unhandledRejection')
    try {
      logger.fatal('process.on.unhandledRejection', reason)
    } catch (err) {
      console.error(reason)
    }

    process_signal_handler('unhandledRejection')
  })

  process.on('uncaughtException', (err: Error, _origin: any) => {
    debug('process.on.uncaughtException')

    try {
      logger.fatal('process.on.uncaughtException', err, _origin)
    } catch (e) {
      console.error(e)
    }

    process_signal_handler('uncaughtException')
  })

  // keep the process running - demo purposes keep process running for 30 seconds
  if (duration)
    setTimeout(() => {
      process.kill(process.pid, 'SIGINT')
    }, duration * 1000)

  // keep the process running - demo purposes keep process running for 600 seconds
  setTimeout(() => {
    process.kill(process.pid, 'SIGTERM')
  }, 600 * 1000)
}
