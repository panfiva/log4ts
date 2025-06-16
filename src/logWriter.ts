import type { LevelName, LoggerArg } from './types'
import type { LoggingEvent } from './loggingEvent'
import type { Logger } from './logger'

import { getEventBus } from './eventBus'

import debugLib from 'debug'
const debugShutdown = debugLib('log4ts:logWriter:shutdown')
// const debugLogWriter = debugLib('log4ts:logWriter:_write')

type WriteMethod<D> = ((data: D) => Promise<void>) | ((data: D) => void)

export type ShutdownCb = ((e?: Error) => void) | ((e?: Error) => Promise<void>)

export type ShutdownFn = ((cb?: ShutdownCb) => Promise<void>) | ((cb?: ShutdownCb) => void)

export type TransformerFn<
  TData extends Array<LoggerArg>,
  TFormattedData,
  TConfigA extends Record<string, any>,
  TContext extends Record<string, any>,
> = (
  event: LoggingEvent<TData, TContext>,
  logWriterName: string,
  logWriterConfig: TConfigA
) => TFormattedData

/**
 * class that writes logs to the destination repository
 */
export abstract class LogWriter<
  // data shape that logWriter accepts
  TFormattedData,
  // logWriter config parameters
  TConfigA extends Record<string, any>,
> {
  name: string

  /** contains references to all active writes */
  protected activeWrites = new Set<object>()

  /** logWriter configurations */
  abstract config: TConfigA

  /** indicate that shutdown event was triggered */
  isShuttingDown: boolean = false

  constructor(name: string) {
    this.name = name
  }

  /**
   * Used by EventBus to trigger shutdown for appenders. During the shutdown,
   * pending events will be granted 5 seconds to complete before executing `this._shutdown`
   */
  shutdownWriter: ShutdownFn = async (cb) => {
    this.isShuttingDown = true

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

    return this._shutdown(cb)
  }

  /** function executed on logWriter shutdown */
  protected _shutdown: ShutdownFn = (cb) => {
    if (cb) cb()
  }

  async attachToLogger<TLogger extends Logger<any, any>>(
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
      TLogger extends Logger<any, infer TContext> ? TContext : never
    >
  ): Promise<void> {
    // type TData = TLogger extends Logger<infer U, any> ? U : never
    // type TContext = TLogger extends Logger<any, infer U> ? U : never

    const listener = function (
      this: LogWriter<TFormattedData, TConfigA>,
      event: LoggingEvent<any, any> // do not use TData and TContext since we are pushing generic listeners
    ) {
      const data = transformer(event, this.name, this.config)

      this.write(data)
    }.bind(this)

    const eventBus = await getEventBus()

    await eventBus.addMessageListener({
      levelName,
      listener,
      logWriter: this,
      logger,
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
   * listeners are added to `EventBus.logWriterListeners` by `LogWriterClass.attachToLogger()`;
   */
  write: WriteMethod<TFormattedData> = async (data: TFormattedData) => {
    const pointer = {}
    this.activeWrites.add(pointer)

    try {
      await this._write(data)
    } catch (err: any) {
      // debugLogWriter(`[${this.name}]: error writing request`, err)
      console.error(`[${this.name}]:`, `error writing request`, err)
    } finally {
      this.activeWrites.delete(pointer)
    }

    return
  }

  /**
   * function that writes event data
   * At this point, data is transformed by the Transformer class
   *
   * Warning! Use _write when file writer needs to be used
   */
  protected abstract _write: WriteMethod<TFormattedData>
}
