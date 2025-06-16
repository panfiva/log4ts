import { LogWriter, ShutdownCb } from '../logWriter'
import { FileLogWriter, FileLogWriterConfig } from './fileLogWriter'
import path from 'path'
import { Mutex } from 'async-mutex'

import debugLib from 'debug'
const debug = debugLib('log4ts:logWriter:multiFileLogWriter')

export type MultiFileLogWriterOptions = {
  baseDir: string
  /** timeout duration (ms) before file write is closed due to inactivity */
  timeout?: number
} & Omit<FileLogWriterConfig, 'filename'>

type Payload = { data: string; filename: string }

export class MultiFileLogWriter extends LogWriter<Payload, MultiFileLogWriterOptions> {
  private state: Map<
    string,
    {
      writer: FileLogWriter
      timer?: { timeout: number; lastUsed: number; interval: NodeJS.Timeout }
    }
  > = new Map()

  private mutex = new Mutex()

  config: MultiFileLogWriterOptions

  constructor(name: string, config: MultiFileLogWriterOptions) {
    super(name)

    this.config = config
  }

  private checkForTimeout(fileKey: string, filename: string) {
    const state = this.state.get(fileKey)

    if (state && state.timer) {
      const expInterval = state.timer.timeout + state.timer.lastUsed - Date.now()

      if (expInterval <= 0) {
        debug(
          `[${this.name}]: '${filename}' timer expired ${expInterval} ms; requesting child log writer shutdown`
        )
        clearInterval(state.timer.interval)

        state.writer.shutdownWriter((err) => {
          if (err) {
            debug(`[${this.name}]: '${filename}' ignore error on file shutdown: %s`, err.message)
          }
          debug(`[${this.name}]: '${filename}' deleting state`)
          this.state.delete(fileKey)
        })
      } else {
        debug(`[${this.name}]: '${filename}' timer will expire in ${expInterval} ms`)
        clearInterval(state.timer.interval)

        state.timer.interval = setInterval(
          this.checkForTimeout.bind(this, fileKey, filename),
          expInterval
        )
      }
    } else {
      // will never get here as files and timers are coupled to be added and deleted at same place
      debug(`[${this.name}]: '${filename}' timer or app does not exist`)
    }
  }

  write = async (payload: Payload) => {
    const { baseDir, timeout, ...restConfig } = this.config

    /** combines `config.baseDir` and `payload.filename` */
    const filename = path.join(baseDir, payload.filename)

    /** combines `writer.name`, `config.baseDir` and `payload.filename` */
    const fileKey = `${this.name}:${filename}`

    debug(`[${this.name}]: data received with file key '${filename}'`)

    let state = this.state.get(fileKey)

    // if writer does not exist, create timer and writer
    if (!state || state.writer.isShuttingDown) {
      if (state && state.writer.isShuttingDown) {
        debug(`[${this.name}]: '${filename}' waiting for existing child log writer shutdown`)

        while (state && state.writer.isShuttingDown) {
          await new Promise((resolve) => setTimeout(resolve, 10))
          state = this.state.get(fileKey)
        }
      }

      // Use mutex to prevent concurrency issues
      const release = await this.mutex.acquire()

      try {
        let writer: FileLogWriter
        const reReadState = this.state.get(fileKey)
        if (reReadState) {
          debug(`[${this.name}]: '${filename}' using existing child writer and timer`)
          state = reReadState
          writer = reReadState.writer
        } else {
          debug(`[${this.name}]: '${filename}' creating new child writer and timer`)
          writer = new FileLogWriter(fileKey, { filename: filename, ...restConfig })
          state = {
            writer,
            timer: !timeout
              ? undefined
              : {
                  timeout,
                  lastUsed: Date.now(),
                  interval: setInterval(
                    this.checkForTimeout.bind(this, fileKey, filename),
                    timeout
                  ),
                },
          }
        }
        this.state.set(fileKey, state)
        state.writer._write(payload.data)
      } finally {
        release()
      }
    }
    // if writer exists and timeout is enabled, extend timeout
    else if (this.config.timeout) {
      debug(`[${this.name}]: '${fileKey}' extending activity`)
      const { timer } = this.state.get(fileKey)!
      if (timer) timer.lastUsed = Date.now()
      state.writer._write(payload.data)
    } else {
      state.writer._write(payload.data)
    }
  }

  protected _shutdown = (cb?: ShutdownCb) => {
    const fileKeys = this.state.keys()
    fileKeys.forEach((fileKey) => {
      const v = this.state.get(fileKey)
      if (v?.timer) clearInterval(v.timer.interval)
      if (v?.writer)
        v.writer.shutdownWriter((err) => {
          if (err) {
            debug(`[${this.name}]: '${fileKey}' ignore error on file shutdown: %s`, err.message)
          }
          debug(`[${this.name}]: '${fileKey}' deleting state`)
          this.state.delete(fileKey)
        })
    })

    if (cb) cb()
  }
}
