import type { LevelName, LoggerArg } from './types'
import type { LoggingEvent } from './loggingEvent'
import type { Logger } from './logger'

import { getEventBus } from './eventBus'

type WriteMethod<D> = (data: D) => Promise<void> | void

export type ShutdownCb = ((e?: Error) => void) | ((e?: Error) => Promise<void>)

export type TransformerFn<
  TData extends Array<LoggerArg>,
  TFormattedData,
  TConfigA extends Record<string, any>,
  TNameA extends string,
> = (event: LoggingEvent<TData>, logWriterName: TNameA, logWriterConfig: TConfigA) => TFormattedData

/**
 * class that writes logs to the destination repository
 */
export abstract class LogWriter<
  // data shape that logWriter accepts
  TFormattedData,
  // logWriter config parameters
  TConfigA extends Record<string, any>,
  TNameA extends string,
> {
  name: TNameA

  /** logWriter configurations */
  abstract config: TConfigA

  constructor(name: TNameA) {
    this.name = name
  }

  /** function executed on logWriter shutdown */
  shutdown: (cb?: ShutdownCb) => Promise<void> | void = (cb) => {
    if (cb) cb()
  }

  attachToLogger<TLogger extends Logger<any[], string>>(
    logger: TLogger,

    /**
     * controls what low writers will receive message sent by a logger
     *
     * this is different from Logger.level property that controls what messages are sent to log writers
     */
    levelName: LevelName,

    /** callback function that transforms event payload to format accepted by logWriter  */
    transformer: TransformerFn<
      TLogger extends Logger<infer TData, any> ? TData : never,
      TFormattedData,
      TConfigA,
      TNameA
    >
  ): void {
    type TData = TLogger extends Logger<infer U, any> ? U : never

    const listener = function (
      this: LogWriter<TFormattedData, TConfigA, TNameA>,
      event: LoggingEvent<TData>
    ) {
      const data = transformer(event, this.name, this.config)

      this.write(data)
    }.bind(this)

    getEventBus().then((eventBus) => {
      eventBus.addMessageListener({
        loggerName: logger.loggerName,
        levelName,
        listener,
        logWriter: this,
        logger,
      })
    })
  }

  /**
   * function that writes event data
   * At this point, data is transformed by the Transformer class
   */
  abstract write: WriteMethod<TFormattedData>
}
