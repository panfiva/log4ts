import { LogWriter, ShutdownCb } from '../logWriter'

import { RollingFileWriteStream } from '../rollingFileStream/RollingFileWriteStream'
import * as path from 'path'
import * as os from 'os'

import { getEventBus } from '../eventBus'

import debugLib from 'debug'
const debug = debugLib('log4ts:logWriter:file')

const eol = os.EOL

let mainSighupListenerStarted = false
const sighupListeners = new Set<FileLogWriter>()

function mainSighupHandler() {
  sighupListeners.forEach((logWriter) => {
    logWriter.sighupHandler()
  })
}

// see https://github.com/chalk/ansi-regex/blob/main/index.js
function ansiRegex({ onlyFirst = false } = {}) {
  //
  const ST = '(?:\\u0007|\\u001B\\u005C|\\u009C)'
  const pattern = [
    `[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?${ST})`,
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))',
  ].join('|')

  return new RegExp(pattern, onlyFirst ? undefined : 'g')
}

export type FileLogWriterConfig = {
  filename: string
  maxLogSize?: number
  backups?: number
  mode?: number
  encoding?: BufferEncoding
  /** if true, color pattern (`\x1b[[0-9;]*`) is removed from incoming string */
  removeColor?: boolean
}

/** data accepted by logWriter */
type FileLogWriterData = string

export class FileLogWriter extends LogWriter<FileLogWriterData, FileLogWriterConfig> {
  config: Required<FileLogWriterConfig>
  private writer: RollingFileWriteStream

  constructor(name: string, config: FileLogWriterConfig) {
    super(name)

    if (typeof config.filename !== 'string' || config.filename.length === 0) {
      throw new Error(`Invalid filename: ${config.filename}`)
    } else if (config.filename.endsWith(path.sep)) {
      throw new Error(`Filename is a directory: ${config.filename}`)
    }

    const filename =
      config.filename.indexOf(`~${path.sep}`) === 0
        ? config.filename.replace('~', os.homedir())
        : config.filename

    this.config = {
      backups: config.backups ?? 5,
      filename: path.normalize(filename),
      mode: config.mode || 0o600,
      maxLogSize: config.maxLogSize ?? 1 * 1024 * 1024,
      encoding: config.encoding ?? 'utf-8',
      removeColor: config.removeColor ?? true,
    }

    debug(`Creating file log writer '${name}' ${JSON.stringify(this.config)}`)

    this.writer = this.openStream()

    sighupListeners.add(this)
    if (!mainSighupListenerStarted) {
      process.on('SIGHUP', mainSighupHandler)
      mainSighupListenerStarted = true
    }
  }

  private openStream() {
    // const stream = new streams.RollingFileStream(filePath, fileSize, numFiles, opt)
    const stream = new RollingFileWriteStream(this.config.filename, {
      maxSize: this.config.maxLogSize,
      backups: this.config.backups,
      encoding: this.config.encoding,
      mode: this.config.mode,
    })

    stream.on('error', (err: Error) => {
      console.error(
        'log4ts.fileLogWriter - Writing to file %s, error happened ',
        this.config.filename,
        err
      )
    })

    stream.on('drain', () => {
      getEventBus().then((v) => {
        v.emit('log4ts:pause', {
          pause: false,
          className: this.constructor.name,
          logWriterName: this.name,
        })
      })
    })

    getEventBus().then((v) => {
      v.emit('log4ts:pause', {
        pause: false,
        className: this.constructor.name,
        logWriterName: this.name,
      })
    })

    return stream
  }

  write = (data: FileLogWriterData): void => {
    if (!this.writer.writable) {
      return
    }
    if (this.config.removeColor === true) {
      // eslint-disable-next-line no-param-reassign
      data = data.replace(ansiRegex(), '')
    }

    if (!this.writer.write(data + eol, 'utf8')) {
      //  writer returns `false` when stream needs to wait for the `'drain'` event to be emitted
      getEventBus().then((v) => {
        v.emit('log4ts:pause', {
          pause: true,
          className: this.constructor.name,
          logWriterName: this.name,
        })
      })
    }
  }

  reopen() {
    this.writer.end(() => {
      this.writer = this.openStream()
    })
  }

  sighupHandler() {
    debug('SIGHUP handler called.')
    this.reopen()
  }

  shutdown = (cb?: ShutdownCb) => {
    sighupListeners.delete(this)
    if (sighupListeners.size === 0 && mainSighupListenerStarted) {
      process.removeListener('SIGHUP', mainSighupHandler)
      mainSighupListenerStarted = false
    }
    this.writer.end('', 'utf-8', cb)
  }
}
