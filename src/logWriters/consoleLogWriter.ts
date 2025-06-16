import { LogWriter } from '../logWriter'

import debugLib from 'debug'
const debug = debugLib('log4ts:logWriter:console')

type EmptyObject = { [K in any]: never }

export class ConsoleLogWriter<TFormattedData extends any[]> extends LogWriter<
  TFormattedData,
  EmptyObject
> {
  config: EmptyObject

  constructor(name: string) {
    super(name)

    this.config = {}

    debug(`[${name}]: Creating console log writer'`)
  }

  write = (data: TFormattedData) => {
    debug(`[${this.name}]: writing log'`)
    console.log(...data)
  }
}
