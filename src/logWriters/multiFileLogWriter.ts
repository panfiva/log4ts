import { LogWriter } from '../logWriterClass'
import { FileLogWriter, FileLogWriterConfig } from './fileLogWriter'
import { ConsoleLogWriter } from './consoleLogWriter'
import path from 'path'

import debugLib from 'debug'
const debug = debugLib('log4ts:logWriter:multiFileLogWriter')

export type MultiFileLogWriterOptions = {
  baseDir: string
  /** timeout duration (ms) before file write is closed due to inactivity */
  timeout?: number
}
//& Omit<FileLogWriterConfig, 'filename'>

type Payload = { data: string; filename: string }

export class MultiFileLogWriter extends LogWriter<Payload, MultiFileLogWriterOptions> {
  // FileLogWriter<string>

  private state: Map<
    string,
    {
      writer: ConsoleLogWriter<string[]>
      timer: { timeout: number; lastUsed: number; interval: NodeJS.Timeout }
    }
  > = new Map()

  config: MultiFileLogWriterOptions

  constructor(name: string, config: MultiFileLogWriterOptions) {
    super(name)

    this.config = config
  }

  private checkForTimeout(fileKey: string, filename: string) {
    const state = this.state.get(fileKey)

    if (state) {
      const expInterval = state.timer.timeout + state.timer.lastUsed - Date.now()

      if (expInterval <= 0) {
        debug(`[${this.name}]: '${filename}' timer expired ${expInterval} ms`)
        clearInterval(state.timer.interval)

        debug(`[${this.name}]: '${filename}' sending shutdown to child log writer`)
        state.writer._shutdown((err) => {
          if (err) {
            debug(`[${this.name}]: '${filename}' ignore error on file shutdown: %s`, err.message)
          }
          debug(`[${this.name}]: '${filename}' deleting state for shutdown appender`)
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

  write = async (data: Payload) => {
    const filename = path.join(this.config.baseDir, data.filename)
    const fileKey = `${this.name}-${filename}`
    debug(`[${this.name}]: data received with file key '${filename}'`)

    let state = this.state.get(fileKey)

    // if writer does not exist, create timer and writer
    if (!state || state.writer.isShuttingDown) {
      if (state && state.writer.isShuttingDown) {
        debug(`[${this.name}]: '${filename}' waiting for existing log writer shutdown`)

        while (state && state.writer.isShuttingDown) {
          await new Promise((resolve) => setTimeout(resolve, 10))
          state = this.state.get(fileKey)
        }
      }

      debug(`[${this.name}]: '${filename}' creating new writer`)

      if (this.config.timeout) {
        debug(`[${this.name}]: creating new timer`)

        const writer = new ConsoleLogWriter(fileKey)

        // fixMe: while better, this is still prone to concurrency issues
        // suggested to use async-mutex library for initializing new files
        // this will create performance impact; however this will only happen:
        //    - on initiali writer initialization
        //    - on writer initialization after writer was terminated
        const reReadState = this.state.get(fileKey)
        if (reReadState) {
          state = reReadState
          console.error(new Error(`[${this.name}]: Error: concurrency issue detected`))
        } else {
          state = {
            writer,
            timer: {
              timeout: this.config.timeout,
              lastUsed: Date.now(),
              interval: setInterval(
                this.checkForTimeout.bind(this, fileKey, filename),
                this.config.timeout
              ),
            },
          }
        }

        this.state.set(fileKey, state)
      }
    }
    // if writer exists and timeout is enabled, extend timeout
    else if (this.config.timeout) {
      debug(`[${this.name}]: '${fileKey}' extending activity`)
      const { timer } = this.state.get(fileKey)!
      timer.lastUsed = Date.now()
    }

    const d = data.data

    state?.writer._write([d])
  }

  // async write2(event: event: LoggingEvent<any[], any>) {

  //   const category = event.categoryName || 'default'
  //   let writer = this.writers.get(category)
  //   if (!writer) {
  //     const filePath = `${this.baseDir}/${this.fileNameFn(category)}`
  //     writer = new FileLogWriter({ filePath })
  //     this.writers.set(category, writer)
  //   }
  //   await writer.write(event)
  // }

  // async close() {
  //   for (const writer of this.writers.values()) {
  //     await writer.close()
  //   }
  //   this.writers.clear()
  // }
}
