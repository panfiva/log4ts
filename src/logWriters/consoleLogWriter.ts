import { LogWriter } from '../logWriter'

import debugLib from 'debug'
const debug = debugLib('log4ts:logWriter:console')

export type ConsoleLogWriterParam = any[]
export type ConsoleLogWriterConfig = never

export class ConsoleLogWriter<LogWriterParam extends ConsoleLogWriterParam> extends LogWriter<
  LogWriterParam,
  ConsoleLogWriterConfig
> {
  constructor(name: string) {
    super({ name, config: {} })
    debug(`[${name}]: Creating console log writer'`)
  }

  protected _write = (data: LogWriterParam) => {
    debug(`[${this.name}]: writing log'`)
    console.log(...data)
  }
}
