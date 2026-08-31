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
  | 'gray'
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

type _LoggerConfig<LoggerContext extends Record<string, any>> = {
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

  /** context applied to all logger calls */
  context?: LoggerContext
}

// Helper type: If LoggerContext is any, context is optional; otherwise required
// If LoggerContext is never, throw error to indicate never should not be used; use any instead
// If LoggerContext is any, context is optional
// Otherwise, context is required
export type LoggerConfig<LoggerContext extends Record<string, any>> = [LoggerContext] extends [
  never,
]
  ? Omit<_LoggerConfig<LoggerContext>, 'context'> & {
      context: Record<'never not allowed for context', 'use any instead'>
    }
  : [unknown] extends [LoggerContext]
    ? Omit<_LoggerConfig<LoggerContext>, 'context'> & { context?: LoggerContext }
    : Omit<_LoggerConfig<LoggerContext>, 'context'> & { context: LoggerContext }
