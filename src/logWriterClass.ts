import type { LevelName, LoggerArg } from './types'
import type { LoggingEvent } from './loggingEvent'
import type { Logger } from './logger'

import { getEventBus } from './eventBus'

import debugLib from 'debug'
const debugShutdown = debugLib('log4ts:logWriter:shutdown')
const debugLogWriter = debugLib('log4ts:logWriter:_write')

type WriteMethod<D> = ((data: D) => Promise<void>) | ((data: D) => void)

export type ShutdownCb = ((e?: Error) => void) | ((e?: Error) => Promise<void>)

type ShutdownFn = ((cb?: ShutdownCb) => Promise<void>) | ((cb?: ShutdownCb) => void)

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

  /** contains references to all active writes */
  protected activeWrites = new Set<object>()

  /** logWriter configurations */
  abstract config: TConfigA

  constructor(name: TNameA) {
    this.name = name
  }

  /** use by EventBus to trigger shutdown */
  _shutdown: ShutdownFn = async (cb) => {
    debugShutdown(
      `[${this.name}]: shutdown event received; ${this.activeWrites.size} pending writes`
    )

    const start = Date.now()
    const maxWait = 5000

    // Wait for all writes up to 5 seconds
    while (this.activeWrites.size > 0 && Date.now() - start < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }

    debugShutdown(`[${this.name}]: initiating shutdown; ${this.activeWrites.size} pending writes`)

    return this.shutdown(cb)
  }

  /** function executed on logWriter shutdown */
  shutdown: ShutdownFn = (cb) => {
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

      this._write(data)
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
   * This function is executed when messages are received by log writer;
   * This function performs the following:
   * - Adds event to `this.activeWrites`
   * - calls `this.write()`
   * - removes event from `this.activeWrites`
   *
   * execution is triggered by `EventBus.sendToListeners()` function call;
   * listeners are added by to `EventBus.listeners()` by `LogWriterClass.attachToLogger()`;
   */
  private _write: WriteMethod<TFormattedData> = async (data: TFormattedData) => {
    const pointer = {}
    this.activeWrites.add(pointer)

    try {
      await this.write(data)
    } catch (err: any) {
      debugLogWriter(`[${this.name}]: error writing request`, err)
    } finally {
      debugLogWriter(`[${this.name}]: write complete`)
      this.activeWrites.delete(pointer)
    }

    return
  }

  /**
   * function that writes event data
   * At this point, data is transformed by the Transformer class
   */
  abstract write: WriteMethod<TFormattedData>
}
