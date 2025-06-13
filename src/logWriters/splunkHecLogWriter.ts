import { LogWriter, ShutdownCb } from '../logWriterClass'

import axios from 'axios'
import https from 'https'
import { transformAxiosError } from './transformAxiosError'

const agent = new https.Agent({
  rejectUnauthorized: false, // This is the key line
})

import debugLib from 'debug'
const debug = debugLib('log4ts:logWriter:splunkHec')

export type SplunkHecLogWriterConfig = {
  /**
   * base URL for Splunk
   * @example 'https://splunk.demo.com:8088'
   */
  baseURL: string
  /** HTTP Event Collector Token */
  token: string
}

export type SplunkData<T extends Record<string, any>> = {
  time: number
  host: string
  sourcetype: 'json'
  source: string
  index: string
  event: T
}

type TConfigA = SplunkHecLogWriterConfig

export class SplunkHecLogWriter<
  TFormattedData extends SplunkData<Record<string, any>>,
  TNameA extends string = string,
> extends LogWriter<TFormattedData, TConfigA, TNameA> {
  config: TConfigA

  private activeWrites = new Set<object>()

  constructor(name: TNameA, config: TConfigA) {
    super(name)

    this.config = config

    debug(`Creating splunk HEC log writer '${name}' for ${this.config.baseURL}`)
  }

  private _write = async (data: TFormattedData) => {
    const payload = { ...data }
    if (!payload.source.startsWith('http:')) payload.source = `http:${payload.source}`

    debug(`LogWriter '${this.name}' writing data`)
    const ret = await axios
      .post('/services/collector/event', payload, {
        baseURL: this.config.baseURL,
        headers: {
          'Authorization': `Splunk ${this.config.token}`,
          'Content-Type': 'application/json',
        },
        httpsAgent: agent,
        timeout: 15000,
      })
      .catch((e) => {
        const err = transformAxiosError(e)
        throw err
      })

    return ret
  }

  write = (data: TFormattedData) => {
    debug(`LogWriter '${this.name}' data received`)

    const pointer = {}
    this.activeWrites.add(pointer)
    this._write(data)
      .catch((err) => {
        debug(`Error in SplunkHecLogWriter.write: ${err.name} ${err.status} ${err.code}`)
      })
      .finally(() => {
        debug(`LogWriter '${this.name}' write complete`)
        this.activeWrites.delete(pointer)
      })
  }

  shutdown = async (cb?: ShutdownCb) => {
    debug(`shutdown event received; ${this.activeWrites.size} pending writes`)

    // Wait for all writes to complete
    while (this.activeWrites.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }

    debug(`shutdown complete`)

    // shutdown function must always execute cb on exit
    if (cb) cb()
  }
}
