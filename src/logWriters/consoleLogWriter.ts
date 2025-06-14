import { LogWriter, ShutdownCb } from '../logWriterClass'

import debugLib from 'debug'
const debug = debugLib('log4ts:logWriter:console')

type EmptyObject = { [K in any]: never }

export class ConsoleLogWriter<
  TFormattedData extends any[],
  TNameA extends string = string,
> extends LogWriter<TFormattedData, EmptyObject, TNameA> {
  config: EmptyObject

  constructor(name: TNameA) {
    super(name)

    this.config = {}

    debug(`Creating console log writer '${name}'`)
  }

  write = (data: TFormattedData) => {
    console.log(...data)
  }
}
