import { LogWriter, ShutdownCb } from '../logWriter'
import { FileLogWriter, FileLogWriterConfig } from './fileLogWriter'
import type { ForceRollOptions } from '../rollingFileStream/types'
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

  /**
   * Tail of the per-file operation chain (see `enqueue`); present only while operations are pending
   */
  private tails = new Map<string, Promise<void>>()

  /** combines `config.baseDir` and a file name relative to it, and builds the child writer key */
  private resolveFile(relativeFilename: string) {
    /** combines `config.baseDir` and `payload.filename` */
    const filename = path.join(this.config.baseDir, relativeFilename)

    /** combines `writer.name`, `config.baseDir` and `payload.filename` */
    const fileKey = `${this.name}:${filename}`

    return { filename, fileKey }
  }

  /**
   * Runs `task` after all previously enqueued tasks for the same file have completed.
   *
   * Getting a child writer is asynchronous (shutdown wait loop, mutex), so without this a
   * `roll()` issued right after a `write()` could overtake it. If nothing is pending for the
   * file, `task` starts synchronously.
   */
  private enqueue<T>(fileKey: string, task: () => Promise<T>): Promise<T> {
    const prev = this.tails.get(fileKey)
    const result = prev ? prev.then(task) : task()

    // the chain must continue whether `task` succeeded or failed
    const tail = result.then(
      () => {},
      () => {}
    )
    this.tails.set(fileKey, tail)
    void tail.then(() => {
      if (this.tails.get(fileKey) === tail) this.tails.delete(fileKey)
    })

    return result
  }

  protected _write = (payload: Payload) => {
    const { filename, fileKey } = this.resolveFile(payload.filename)

    debug(`[${this.name}]: data received with file key '${filename}'`)

    return this.enqueue(fileKey, () =>
      this.withWriter(fileKey, filename, (writer) => {
        writer.write(payload.data)
      })
    )
  }

  /**
   * Rolls a file on demand; see `FileLogWriter.roll`.
   *
   * The roll happens after every `write()` for the same file issued before this call, and
   * writes issued after this call land in the new file. If there is no child writer for the
   * file yet (e.g. right after process start), one is created and the file on disk is rolled.
   *
   * @param filename file name relative to `baseDir`, same as `filename` in the write payload
   */
  async roll(filename: string, opts?: ForceRollOptions): Promise<void> {
    const resolved = this.resolveFile(filename)

    // tracked as an active write so that a shutdown waits for the roll
    const pointer = {}
    this.activeWrites.add(pointer)
    try {
      await this.enqueue(resolved.fileKey, () =>
        this.withWriter(resolved.fileKey, resolved.filename, (writer) => writer.roll(opts))
      )
    } finally {
      this.activeWrites.delete(pointer)
    }
  }

  /**
   * Finds or creates the child writer for the file (waiting out a shutdown in progress) and
   * passes it to `use`
   */
  private async withWriter<T>(
    fileKey: string,
    filename: string,
    use: (writer: FileLogWriter) => T
  ): Promise<T> {
    const { baseDir, timeout, ...restConfig } = this.config

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
        return use(state.writer)
      } finally {
        release()
      }
    }

    // if writer exists and timeout is enabled, extend timeout
    if (this.config.timeout) {
      debug(`[${this.name}]: '${fileKey}' extending activity`)
      const { timer } = this.state.get(fileKey)!
      if (timer) timer.lastUsed = Date.now()
    }
    return use(state.writer)
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
