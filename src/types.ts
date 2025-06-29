import type { Level } from './level'
import type { Logger } from './logger'
import type { LogWriter } from './logWriter'
import type { LogEvent } from './logEvent'

/** Standard level name */
export type LevelName =
  | 'TRACE'
  | 'DEBUG'
  | 'INFO'
  | 'WARN'
  | 'ERROR'
  | 'FATAL'
  | 'ALL'
  | 'MARK'
  | 'OFF'

export type ValidColors =
  | 'white'
  | 'grey'
  | 'black'
  | 'blue'
  | 'cyan'
  | 'green'
  | 'magenta'
  | 'red'
  | 'yellow'

export type LevelParam =
  | LevelName
  | Level
  | { level: number; levelName: LevelName; color: ValidColors }

/**
 * level configurations passed to `Logger` and `LevelRegistry` class constructor
 *
 * Do not use for passing level information between different functions and methods; use `LevelParam` instead
 */
export type LevelConstructorProps = Record<LevelName, { value: number; color: ValidColors }>

// Logger-related types
export type LoggerPrimitiveTypes = string | number | boolean | undefined | bigint | null

export type LoggerArg =
  | string
  | number
  | boolean
  | undefined
  | bigint
  | null
  | Record<string, any>
  | Array<any>
  | Error

// CallStack type
export type CallStack = {
  callStack?: string
  callerName?: string
  className?: string
  columnNumber?: number
  fileName?: string
  functionAlias?: string
  functionName?: string
  lineNumber?: number
}

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>

export type EmptyObject = { [K in any]: never }

export type LayoutFn<
  // Logger data shape
  D extends Array<LoggerArg> = Array<LoggerArg>,
  // logWriter configs
  CA extends Record<string, any> = Record<string, any>,
  // Data accepted by logWriter
  DA = any,
  // Context
  CO extends Record<string, any> = Record<string, any>,
> = (
  data: D,
  options: {
    logWriterConfig: CA
    context: CO
    loggerName: string
    level: Level
  }
) => DA

export type LayoutFnInferred<
  TLogger extends Logger<any, any, any>,
  TLogWriter extends LogWriter<any, any>,
> = (
  event: LogEvent<
    TLogger extends Logger<any, any, infer TDataOut> ? TDataOut : never,
    TLogger extends Logger<any, infer TContext, any> ? TContext : never
  >,
  logWriterName: string,
  logWriterConfig: TLogWriter extends LogWriter<any, infer TConfigA> ? TConfigA : never
) => TLogWriter extends LogWriter<infer TFormattedData, any> ? TFormattedData : never

export type LoggerConfig<TContext extends Record<string, any>> = {
  /** logger name */
  loggerName: string

  /**
   * controls what messages will be sent to log writers using message severity
   *
   * Once requests are sent, they are received by log writers using LogWriter - Logger - Level mapping (see LogWriter.register function)
   */
  level: LevelParam

  /** indicates if callstack should be recorded  */
  useCallStack?: boolean

  context?: TContext
}
