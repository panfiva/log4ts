import debugLib from 'debug'
const debug = debugLib('log4ts:logger')

import { LogEvent } from './logEvent'
import type { LevelParam, LoggerConfig } from './types'
import type { Level } from './level'
import { getLevelRegistry } from './level'
import { getEventBus } from './eventBus'
import { defaultParseCallStack, ParseCallStackFunction } from './defaultParseCallStack'

import { requiredObject } from './utils/requiredObject'

export type TransformFunctionReturn<T> = {
  /** event payload */
  data: T
  /** error that is used to generate error stack */
  error?: Error | { message: string; stack?: string; [x: string]: any }
}

/**
 * The top entry is the Error
 */
const baseCallStackSkip = 1
/**
 * The _log function is 3 levels deep, we need to skip those to make it to the callSite
 */
const defaultErrorCallStackSkip = 3

/**
 * Logger to log messages.
 */
export abstract class Logger<
  /** parameters accepted by the log function */
  LoggerArgs extends any[],
  LoggerContext extends Record<string, any> = never,
  /**
   * data format that is included in log event;
   * this data will be passed to Layout class
   */
  LoggerReturn = LoggerArgs,
> {
  /** logger name */
  loggerName: string

  /**
   * Returns logger with the same name but additional context.
   * Note: Child classes should override this method to provide correct return typing.
   */
  withAddContext(options: Record<string, any>): this {
    const newLogger = new (this.constructor as any)({
      loggerName: this.loggerName,
      level: this._level,
      useCallStack: this.useCallStack,
      context: { ...this.context, ...options },
    }) as this

    // Copy over other properties that might have been set
    newLogger.callStackLinesToSkip = this.callStackLinesToSkip
    if (this.parseCallStack !== defaultParseCallStack) {
      newLogger.setParseCallStackFunction(this.parseCallStack)
    }

    return newLogger
  }

  /** default log level for attached log writers */
  private _level: Level

  /** indicates if callstack should be recorded  */
  useCallStack: boolean

  context: [LoggerContext] extends [never] ? Record<string, never> : LoggerContext
  private callStackSkipIndex = 0

  private parseCallStack: ParseCallStackFunction = defaultParseCallStack

  constructor(param: LoggerConfig<LoggerContext>) {
    this.context = requiredObject<LoggerContext>(param.context)

    const levelRegistry = getLevelRegistry()

    this.loggerName = param.loggerName

    const level = levelRegistry.getLevel(param.level)

    if (!level) throw new Error(`Invalid level parameter: ${JSON.stringify(param.level)}`)

    this._level = level
    this.useCallStack = param.useCallStack ?? false
  }

  get level(): Level {
    const levelRegistry = getLevelRegistry()
    const ret = levelRegistry.getLevel(this._level, levelRegistry.levelsDict['OFF'])
    return ret
  }

  // set level(level) {
  //   const levelRegistry = getLevelRegistry()
  //   const v = levelRegistry.getLevel(level)
  //   if (!v) console.warn(`level ${JSON.stringify(level)} is not configured`)
  //   this._level = v ?? this.level
  // }

  /**
   * By default, logger will skip all stack lines between actual Error and logger function call
   * This value returns the number of additional lines to be skipped
   */
  get callStackLinesToSkip() {
    return this.callStackSkipIndex
  }

  /**
   * By default, logger will skip all stack lines between actual Error and logger function call
   * This setter updates the number of additional lines to be skipped
   */
  set callStackLinesToSkip(number: number) {
    if (number < 0) {
      throw new RangeError('Must be >= 0')
    }
    this.callStackSkipIndex = number
  }

  /**
   * returns data to be saved as `LogEvent.data`
   *
   * If function fails, error is added to console.log
   */
  abstract getLogData(...args: LoggerArgs): LoggerReturn

  /**
   * returns error that will be saved as `LogEvent.error`
   *
   * If function fails, error is added to console.log
   */
  getLogError(...args: LoggerArgs): Error | undefined {
    const error = args.find((item: any) => item instanceof Error)
    return error
  }

  private log(level: LevelParam, ...args: LoggerArgs) {
    const levelRegistry = getLevelRegistry()
    const logLevel = levelRegistry.getLevel(level)

    if (!logLevel) {
      console.error('Cannot send event')
      return
    }

    if (this.isLevelEnabled(logLevel)) {
      let data: any = undefined
      let error: any = undefined
      let hasError: boolean = false

      try {
        data = this.getLogData(...args)
      } catch (e) {
        hasError = true
        console.error('error extracting event data', e)
        console.log('event data', args)
      }

      try {
        error = this.getLogError(...args)
      } catch (e) {
        hasError = true
        console.error('error extracting event error', e)
        console.log('event data', args)
      }

      if (!hasError) this._generateLogEvent(logLevel, data, error)
    }
  }

  trace = (...args: LoggerArgs) => this.log('TRACE', ...args)
  debug = (...args: LoggerArgs) => this.log('DEBUG', ...args)
  info = (...args: LoggerArgs) => this.log('INFO', ...args)
  warn = (...args: LoggerArgs) => this.log('WARN', ...args)
  error = (...args: LoggerArgs) => this.log('ERROR', ...args)
  fatal = (...args: LoggerArgs) => this.log('FATAL', ...args)

  isLevelEnabled(otherLevel: LevelParam) {
    const loggerEnabled = this.level.isLessThanOrEqualTo(otherLevel)

    if (!loggerEnabled) {
      return false
    }

    return true
  }

  /**
   * saves data and error as LogEvent and sends to event bus
   */
  private _generateLogEvent(
    level: LevelParam,
    data: LoggerReturn,
    error?: Error | { message: string; stack?: string; [x: string]: any }
  ) {
    debug(`sending log data (${level}) to log writers`)

    let callStack
    if (this.useCallStack) {
      try {
        if (error) {
          callStack = this.parseCallStack(error, this.callStackSkipIndex + baseCallStackSkip)
        }
      } catch (_err) {
        // Ignore Error and use the original method of creating a new Error.
      }
      callStack =
        callStack ||
        this.parseCallStack(
          new Error(),
          this.callStackSkipIndex + defaultErrorCallStackSkip + baseCallStackSkip
        )
    }
    const logEvent = new LogEvent({
      loggerName: this.loggerName,
      level: level,
      data: data,
      context: this.context,
      location: callStack,
      error,
    })
    const eventBus = getEventBus()
    eventBus.send(logEvent)
  }

  addContext<K extends LoggerContext extends undefined ? never : keyof LoggerContext>(
    key: K,
    value: LoggerContext[K]
  ): void
  addContext(key: keyof LoggerContext, value: any) {
    // @ts-ignore
    this.context[key] = value
  }

  setParseCallStackFunction(parseFunction?: ParseCallStackFunction) {
    if (!parseFunction) this.parseCallStack = defaultParseCallStack
    else this.parseCallStack = parseFunction
  }
}
