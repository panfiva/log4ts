import { LogWriter } from '../logWriter'

import axios from 'axios'
import https from 'https'
import { transformAxiosError } from '../utils/transformAxiosError'
import _ from 'lodash'

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

export type SplunkHecLogWriterParam<T extends Record<string, any>> = {
  time: number
  host: string
  sourcetype: 'json'
  source: string
  index: string
  event: T
}

export class SplunkHecLogWriter<
  LogWriterParam extends SplunkHecLogWriterParam<Record<string, any>>,
> extends LogWriter<LogWriterParam, SplunkHecLogWriterConfig> {
  constructor(name: string, config: SplunkHecLogWriterConfig) {
    super({ name, config })

    debug(`[${this.name}]: initializing log writer for ${this.config.baseURL}`)
  }

  /**
   * Recursively converts all Date objects to ISO strings in an object
   */
  private convertDatesToISO(obj: any): any {
    if (obj instanceof Date) {
      return obj.toISOString()
    }

    if (_.isArray(obj)) {
      return obj.map((item) => this.convertDatesToISO(item))
    }

    if (_.isPlainObject(obj)) {
      const result: any = {}
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.convertDatesToISO(value)
      }
      return result
    }

    return obj
  }

  protected _write = async (data: LogWriterParam) => {
    const payload = { ...data }
    if (!payload.source.startsWith('http:')) payload.source = `http:${payload.source}`

    // Convert all Date objects in event to ISO strings
    if (_.isObject(payload.event)) {
      payload.event = this.convertDatesToISO(payload.event)
    }

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
