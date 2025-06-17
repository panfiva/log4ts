import debugLib from 'debug'
const debug = debugLib('log4ts:configure_process')

import { Logger, ConsoleLogWriter, shutdown } from '..'

type Seconds = number

export const configure_process = (/** duration in seconds before exit */ duration?: Seconds) => {
  type LoggerData = any[]
  type WriterData = any[]

  const logger = new Logger<LoggerData, never>({
    level: 'DEBUG',
    loggerName: 'node_process_logger',
    useCallStack: false,
  })

  const logWriter = new ConsoleLogWriter<WriterData>('node_process_writer')

  logWriter.register(logger, 'DEBUG', (event) => {
    return [`[node_process_writer]:`, event.startTime, `[${event.level.levelName}]`, ...event.data]
  })

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
