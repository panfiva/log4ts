import type { LevelName } from './types'
import type { LogEvent } from './logEvent'

import { getEventBus, EventListenerConfig } from './eventBus'
import { Layout } from './layout'

import debugLib from 'debug'
const debugShutdown = debugLib('log4ts:logWriter:shutdown')
// const debugLogWriter = debugLib('log4ts:logWriter:_write')

type WriteMethod<D> = ((data: D) => Promise<void>) | ((data: D) => void)

export type ShutdownCb = ((e?: Error) => void) | ((e?: Error) => Promise<void>)

export type ShutdownFn = ((cb?: ShutdownCb) => Promise<void>) | ((cb?: ShutdownCb) => void)

// Helper type: If TLoggerReturnContext is any, context is optional; otherwise required
// If TLoggerReturnContext is never, throw error to indicate never should not be used; use any instead
// If TLoggerReturnContext is any, context is optional
// Otherwise, context is required
export type LogWriterConstructorParams<LogWriterConfig extends Record<string, any>> = ([
  LogWriterConfig,
] extends [never]
  ? { config: Record<'never not allowed for context', 'use any instead'> }
  : [unknown] extends [LogWriterConfig]
    ? { config?: LogWriterConfig }
    : { config: LogWriterConfig }) & { name: string }

/**
 * class that writes logs to the destination repository
 */
export abstract class LogWriter<
  // data shape that logWriter accepts
  LogWriterParam,
  // logWriter config parameters
  LogWriterConfig extends Record<string, any>,
> {
  name: string

  /** contains references to all active writes */
  protected activeWrites = new Set<object>()

  /** logWriter configurations */
  config: LogWriterConfig

  /** indicate that shutdown event was triggered */
  isShuttingDown: boolean = false

  constructor(params: LogWriterConstructorParams<LogWriterConfig>) {
    this.config = params.config ?? ({} as any)
    this.name = params.name
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

  /**
   * Generates event listener function executes layout function to transform event data to format accepted by log writer
   */

  register<TLoggerReturnContext extends Record<string, any>, LoggerReturnData = any>(
    loggerName: string,

    /**
     * controls what low writers will receive message sent by a logger
     *
     * this is different from Logger.level property that controls what messages are sent to log writers
     */
    levelName: LevelName,

    /** Layout class constructor that transforms event payload to format accepted by logWriter  */
    layout: Layout<LoggerReturnData, LogWriterParam, TLoggerReturnContext, LogWriterConfig>
  ): void {
    const listener: EventListenerConfig<any, any, any, any>['listener'] = function (
      this: LogWriter<LogWriterParam, LogWriterConfig>,
      event: LogEvent<any, any> // do not use TData and TContext since we are pushing generic listeners
    ) {
      const data = layout.format(event)
      this.write(data)
    }.bind(this)

    const eventBus = getEventBus()

    eventBus.addMessageListener({
      levelName,
      listener,
      logWriter: this,
      loggerName,
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
   * listeners are added to `EventBus.logWriterListeners` by `LogWriterClass.register()`;
   */
  write: WriteMethod<LogWriterParam> = async (data: LogWriterParam) => {
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
   * At this point, data is transformed by the registered layout function
   *
   * Warning! Use _write when file writer needs to be used
   */
  protected abstract _write: WriteMethod<LogWriterParam>
}
