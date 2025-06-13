import type { Level } from './level'

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

export type TransformerFn<
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

export type LoggerProps<TName extends string> = {
  /** logger name */
  loggerName: TName

  /**
   * controls what messages will be sent to log writers using message severity
   *
   * Once requests are sent, they are received by log writers using LogWriter - Logger - Level mapping (see LogWriter.attachToLogger function)
   */
  level: LevelParam

  /** indicates if callstack should be recorded  */
  useCallStack?: boolean
}
