import debugLib from 'debug'
const debug = debugLib('log4ts:logger')

import { LoggingEvent } from './loggingEvent'
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

/**
 * Logger to log messages.
 */
export class Logger<TData extends any[], TContext extends Record<string, any> = never> {
  /** logger name */
  loggerName: string

  /** default log level for attached log writers */
  private _level: Level

  /** indicates if callstack should be recorded  */
  useCallStack: boolean

  context: TContext
  private callStackSkipIndex = 0

  private parseCallStack: ParseCallStackFunction = defaultParseCallStack

  constructor(param: LoggerConfig<TContext>) {
    this.context = param.context ?? ({} as TContext) // allow to update later

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

  private log(level: LevelParam, ...args: TData) {
    const levelRegistry = getLevelRegistry()
    const logLevel = levelRegistry.getLevel(level)

    if (!logLevel) {
      console.error('Cannot send event')
      return
    }

    if (this.isLevelEnabled(logLevel)) {
      this._log(logLevel, args)
    }
  }

  trace = (...args: TData) => this.log('TRACE', ...args)
  debug = (...args: TData) => this.log('DEBUG', ...args)
  info = (...args: TData) => this.log('INFO', ...args)
  warn = (...args: TData) => this.log('WARN', ...args)
  error = (...args: TData) => this.log('ERROR', ...args)
  fatal = (...args: TData) => this.log('FATAL', ...args)

  isLevelEnabled(otherLevel: LevelParam) {
    const loggerEnabled = this.level.isLessThanOrEqualTo(otherLevel)

    if (!loggerEnabled) {
      return false
    }

    return true
  }

  private _log(level: LevelParam, data: TData) {
    debug(`sending log data (${level}) to log writers`)
    const error = data.find((item) => item instanceof Error)
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
    const loggingEvent = new LoggingEvent({
      loggerName: this.loggerName,
      level: level,
      data: data,
      context: this.context,
      location: callStack,
      error,
    })
    const eventBus = getEventBus()
    eventBus.send(loggingEvent)
  }

  addContext<K extends TContext extends undefined ? never : keyof TContext>(
    key: K,
    value: TContext[K]
  ): void
  addContext(key: keyof TContext, value: any) {
    this.context[key] = value
  }

  removeContext(key: string) {
    delete this.context[key]
  }

  clearContext() {
    this.context = {} as TContext
  }

  setParseCallStackFunction(parseFunction?: ParseCallStackFunction) {
    if (!parseFunction) this.parseCallStack = defaultParseCallStack
    else this.parseCallStack = parseFunction
  }
}
