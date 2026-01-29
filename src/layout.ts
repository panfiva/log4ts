import type { LogEvent } from './logEvent'

/** returns constructor props from a class */
export type ExtractConstructorArgs<T extends Layout<any, any, any, any>> = ConstructorParameters<{
  new (...args: any[]): T
}>[0]

/**
 * Returns constructor for Layout Class
 */
export type LayoutConstructor<
  LoggerReturn = any,
  LogWriterParam = any,
  LoggerContext extends Record<string, any> = Record<string, any>,
  LogWriterConfig extends Record<string, any> = Record<string, any>,
  T extends Layout<LoggerReturn, LogWriterParam, LoggerContext, LogWriterConfig> = Layout<
    LoggerReturn,
    LogWriterParam,
    LoggerContext,
    LogWriterConfig
  >,
> = new (...args: [ExtractConstructorArgs<T>]) => T

/**
 * transforms `LoggerReturn` that was saved inside `LogEvent`
 * to `LogWriterParam` that is accepted by log writer
 */
export abstract class Layout<
  LoggerReturn = any,
  LogWriterParam = any,
  LoggerContext extends Record<string, any> = Record<string, any>,
  LogWriterConfig extends Record<string, any> = Record<string, any>,
> {
  /** log writer that is attached to the */
  logWriterName: string
  /** log writer that is attached to the */
  logWriterConfig: LogWriterConfig
  /** Logger Name that triggered the event */
  loggerName: string

  constructor(props: {
    logWriterName: string
    logWriterConfig: LogWriterConfig
    loggerName: string
  }) {
    this.logWriterName = props.logWriterName
    this.logWriterConfig = props.logWriterConfig
    this.loggerName = props.loggerName
  }

  /** converts LogEvent to format accepted by LogWriter */
  abstract format(event: LogEvent<LoggerReturn, LoggerContext>): LogWriterParam
}
