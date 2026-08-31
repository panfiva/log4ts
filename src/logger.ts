import debugLib from 'debug'
const debug = debugLib('log4ts:logger')

import { LogEvent } from './logEvent'
import type { LevelParam, LoggerConfig } from './types'
import type { Level } from './level'
import { getLevelRegistry } from './level'
import { getEventBus } from './eventBus'
import { defaultParseCallStack, ParseCallStackFunction } from './defaultParseCallStack'

/**
 * The top entry is the Error
 */
const baseCallStackSkip = 1
/**
 * The _log function is 3 levels deep, we need to skip those to make it to the callSite
 */
const defaultErrorCallStackSkip = 3

type ErrorLike =
  | Error
  | {
      [x: string]: any
      message: string
      name?: string
      stack?: string
    }

/**
 * return type of `Logger.buildEventPayload()` and input of `Logger.generateLogEvent()`

 */
export type BuildEventDataResult<LoggerReturnData, LoggerReturnContext> = {
  /** event data; produced by `buildEventPayload` function using logger context and logger call args */
  data: LoggerReturnData
  /** event context; produced by `buildEventPayload` function using logger context and logger call args */
  context: LoggerReturnContext
  /** event context; produced by `buildEventPayload` function using logger context and logger call args */
  error: Error | ErrorLike | undefined
}

/**
 * Logger to log messages.
 */
export abstract class Logger<
  /** parameters accepted by the log function */
  LoggerArgs extends any[],
  LoggerContext extends Record<string, any>,
  /**
   * data format that is included in log event;
   * this data will be passed to Layout class
   *
   * returned by `getLogData` function
   */
  LoggerReturnData,
  /** data included in log event context */
  LoggerReturnContext extends Record<string, any>,
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

  context: LoggerContext
  private callStackSkipIndex = 0

  private parseCallStack: ParseCallStackFunction = defaultParseCallStack

  constructor(param: LoggerConfig<LoggerContext>) {
    this.context = param.context ?? ({} as any)

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
   * Called by Logger to convert log function arguments and context to LogEvent:
   * - returns {data, context, error} to be attached to the event
   * - event is generated `Logger.(logLevel, { data, context, error })`
   *
   * If function fails, error is added to console.log
   */
  abstract buildEventPayload(
    ...args: LoggerArgs
  ): BuildEventDataResult<LoggerReturnData, LoggerReturnContext>

  /**
   * Utility function that can be used in custom loggers to find first error in args.
   * Use in custom `buildEventPayload` functions as needed.
   */
  getFirstError(...args: LoggerArgs): Error | undefined {
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
      let context: any = undefined
      let hasError: boolean = false

      try {
        const eventData = this.buildEventPayload(...args)
        data = eventData.data
        error = eventData.error
        context = eventData.context
      } catch (e) {
        hasError = true
        console.error('error extracting event data', e)
        console.log('event data', args)
      }

      if (!hasError) {
        const logEvent = this.generateLogEvent(logLevel, { data, context, error })
        const eventBus = getEventBus()
        eventBus.send(logEvent)
      }
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
   *
   * uses output of `buildEventPayload` method
   */
  protected generateLogEvent(
    level: LevelParam,
    payload: BuildEventDataResult<LoggerReturnData, LoggerReturnContext>
  ) {
    debug(`sending log data (${level}) to log writers`)

    const { data, context, error } = payload

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

    type TLoggerContext = BuildEventDataResult<LoggerReturnData, LoggerReturnContext>['context']

    const logEvent = new LogEvent<LoggerReturnData, TLoggerContext>({
      loggerName: this.loggerName,
      level: level,
      data: { ...data },
      context: { ...context },
      location: callStack,
      error,
    })
    return logEvent
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
