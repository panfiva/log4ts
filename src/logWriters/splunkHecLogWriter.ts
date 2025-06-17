import { LogWriter } from '../logWriter'

import axios from 'axios'
import https from 'https'
import { transformAxiosError } from './transformAxiosError'

const agent = new https.Agent({
  rejectUnauthorized: false, // Use if Splunk cert is self-signed
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
> extends LogWriter<TFormattedData, TConfigA> {
  config: TConfigA

  constructor(name: string, config: TConfigA) {
    super(name)

    this.config = config

    debug(`[${this.name}]: initializing log writer for ${this.config.baseURL}`)
  }

  protected _write = async (data: TFormattedData) => {
    const payload = { ...data }
    if (!payload.source.startsWith('http:')) payload.source = `http:${payload.source}`

    debug(`[${this.name}]: sending data`)

    await new Promise((resolve) => setTimeout(resolve, 200))

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
      .then((v) => {
        debug(`[${this.name}]: event send successfully`)
        return v
      })
      .catch((e) => {
        const err = transformAxiosError(e)
        debug(`[${this.name}]: event write failed`)
        throw err
      })

    return ret
  }
}
