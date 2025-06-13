import { LogWriter, ShutdownCb } from '../logWriterClass'

import debugLib from 'debug'
const debug = debugLib('log4ts:logWriter:example')

export type ExampleLogWriterConfig = { example: string }

export class ExampleLogWriter<
  TFormattedData,
  TConfigA extends Record<string, any>,
  TNameA extends string = string,
> extends LogWriter<TFormattedData, TConfigA, TNameA> {
  config: TConfigA

  constructor(name: TNameA, config: TConfigA) {
    super(name)

    this.config = config

    debug(`Creating example log writer '${name}' ${JSON.stringify(this.config)}`)
  }

  write = (data: TFormattedData) => {
    console.log(data)
  }

  shutdown = (cb?: ShutdownCb) => {
    // shutdown function must always execute cb on exit
    if (cb) cb()
  }
}
