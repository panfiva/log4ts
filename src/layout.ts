import type { LogEvent } from './logEvent'

/**
 * transforms `LoggerReturnData` that was saved inside `LogEvent`
 * to `LogWriterParam` that is accepted by log writer
 */
export abstract class Layout<
  LoggerReturnData = any,
  LogWriterParam = any,
  LoggerReturnContext extends Record<string, any> = Record<string, any>,
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
  abstract format(event: LogEvent<LoggerReturnData, LoggerReturnContext>): LogWriterParam
}
