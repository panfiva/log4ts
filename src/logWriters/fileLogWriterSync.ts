import { LogWriter, ShutdownCb } from '../logWriter'

import { RollingFileWriteSyncStream } from '../rollingFileStream/RollingFileWriteSyncStream'
import { ansiRegex } from '../utils/ansiRegex'
import * as path from 'path'
import * as os from 'os'

import debugLib from 'debug'
const debug = debugLib('log4ts:logWriter:file')

const eol = os.EOL

let mainSighupListenerStarted = false
const sighupListeners = new Set<FileLogWriterSync>()

function mainSighupHandler() {
  sighupListeners.forEach((logWriter) => {
    logWriter.sighupHandler()
  })
}

export type FileLogWriterSyncConfig = {
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

export class FileLogWriterSync extends LogWriter<FileLogWriterData, FileLogWriterSyncConfig> {
  config: Required<FileLogWriterSyncConfig>
  private writer: RollingFileWriteSyncStream

  constructor(name: string, config: FileLogWriterSyncConfig) {
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
    const stream = new RollingFileWriteSyncStream(this.config.filename, {
      maxSize: this.config.maxLogSize,
      backups: this.config.backups,
      encoding: this.config.encoding,
      mode: this.config.mode,
    })

    return stream
  }

  protected _write = (data: FileLogWriterData): void => {
    if (this.config.removeColor === true) {
      // eslint-disable-next-line no-param-reassign
      data = data.replace(ansiRegex(), '')
    }

    this.writer.write(data + eol, 'utf-8')
  }

  sighupHandler() {
    debug('SIGHUP handler called.')
    this.writer = this.openStream()
  }

  protected _shutdown = (cb?: ShutdownCb) => {
    sighupListeners.delete(this)
    if (sighupListeners.size === 0 && mainSighupListenerStarted) {
      process.removeListener('SIGHUP', mainSighupHandler)
      mainSighupListenerStarted = false
    }
    if (cb) cb()
  }
}
