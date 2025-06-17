import { LogWriter } from '../logWriter'

import debugLib from 'debug'
const debug = debugLib('log4ts:logWriter:example')

export type ExampleLogWriterConfig = { example: string }

export class ExampleLogWriter<
  TFormattedData,
  TConfigA extends Record<string, any>,
> extends LogWriter<TFormattedData, TConfigA> {
  config: TConfigA

  constructor(name: string, config: TConfigA) {
    super(name)

    this.config = config

    debug(`Creating example log writer '${name}' ${JSON.stringify(this.config)}`)
  }

  protected _write = (data: TFormattedData) => {
    console.log(data)
  }
}
