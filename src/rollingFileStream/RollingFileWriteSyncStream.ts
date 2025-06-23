import debugLib from 'debug'
const debug = debugLib('log4ts:RollingFileWriteSyncStream')

import * as fs from 'fs-extra'
import * as path from 'path'
import * as os from 'os'

import { fileNameFormatterFactory } from './fileNameFormatter'
import { fileNameParserFactory } from './fileNameParser'

import type {
  FileNameFormatterFn,
  RollingFileSyncWriteStreamOptions,
  FileNameParserFn,
  ParsedFilename,
} from './types'

import type { PartialBy } from '../types'

import { asString } from 'date-format'

const newNow = () => new Date()

type RollingFileSyncWriteStreamConfigs = PartialBy<
  Required<RollingFileSyncWriteStreamOptions>,
  'pattern'
>

/**
 * RollingFileWriteSyncStream is mainly used when writing to a file rolling by date or size.
 * RollingFileWriteSyncStream inherits from stream.Writable
 */
export class RollingFileWriteSyncStream {
  currentFileStream: fs.WriteStream = undefined as any

  fileNameFormatter: FileNameFormatterFn

  fileNameParser: FileNameParserFn

  fileObject: path.ParsedPath

  /** file path sent to object constructor */
  filePath: string

  /** formatted filename  */
  filename: string

  state: {
    /** currentDate is set only if pattern is supplied */
    currentDate?: string
    currentSize: number
  }

  options: RollingFileSyncWriteStreamConfigs

  constructor(filePath: string, options: RollingFileSyncWriteStreamOptions) {
    debug(`constructor: creating RollingFileWriteSyncStream. path=${filePath}`)
    if (typeof filePath !== 'string' || filePath.length === 0) {
      throw new Error(`Invalid filename: ${filePath}`)
    } else if (filePath.endsWith(path.sep)) {
      throw new Error(`Filename is a directory: ${filePath}`)
    }

    // handle ~ expansion: https://github.com/nodejs/node/issues/684
    // exclude ~ and ~filename as these can be valid files
    this.filePath =
      filePath.indexOf(`~${path.sep}`) === 0 ? filePath.replace('~', os.homedir()) : filePath

    this.options = this._parseOption(options)

    this.fileObject = path.parse(this.filePath)

    if (this.fileObject.dir === '') {
      this.fileObject = path.parse(path.join(process.cwd(), this.filePath))
    }
    this.fileNameFormatter = fileNameFormatterFactory({
      file: this.fileObject,
      alwaysIncludeDate: this.options.alwaysIncludePattern,
      needsIndex: this.options.maxSize < Number.MAX_SAFE_INTEGER,
      compress: false,
      keepFileExt: this.options.keepFileExt,
      fileNameSep: this.options.fileNameSep,
    })

    this.fileNameParser = fileNameParserFactory({
      file: this.fileObject,
      keepFileExt: this.options.keepFileExt,
      pattern: this.options.pattern,
      fileNameSep: this.options.fileNameSep,
    })

    this.state = {
      currentSize: 0,
    }

    if (this.options.pattern) {
      this.state.currentDate = asString(this.options.pattern, newNow())
    }

    this.filename = this.fileNameFormatter({
      index: 0,
      date: this.state.currentDate,
    })

    if (['a', 'a+', 'as', 'as+'].includes(this.options.flags)) {
      this._setExistingSizeAndDate()
    }

    debug(`constructor: create new file ${this.filename}, state=${JSON.stringify(this.state)}`)
    this._touchFile()

    this._shouldRoll()
  }

  _setExistingSizeAndDate(): void {
    try {
      const stats = fs.statSync(this.filename)
      this.state.currentSize = stats.size
      if (this.options.pattern) {
        this.state.currentDate = asString(this.options.pattern, stats.mtime)
      }
    } catch (e) {
      //file does not exist, that's fine - move along
      return
    }
  }

  private _parseOption(
    rawOptions: RollingFileSyncWriteStreamOptions
  ): RollingFileSyncWriteStreamConfigs {
    const defaultOptions: RollingFileSyncWriteStreamConfigs = {
      maxSize: 0,
      backups: 4,
      encoding: 'utf-8',
      mode: parseInt('0600', 8), // 0o600 in octal
      flags: 'a',
      keepFileExt: false,
      alwaysIncludePattern: false,
      fileNameSep: '.',
      pattern: undefined,
    }
    const options = Object.assign({}, defaultOptions, rawOptions)

    if (options.maxSize < 0) {
      throw new Error(`options.maxSize (${options.maxSize}) should be >= 0`)
    }

    if (options.backups < 0) {
      throw new Error(`options.backups (${options.backups}) should be >= 0`)
    }
    debug(`creating stream with option=${JSON.stringify(options)}`)
    return options
  }

  /** overwrite Stream._write */
  write(chunk: any, encoding: BufferEncoding): void {
    this._shouldRoll()

    this.state.currentSize += chunk.length
    fs.appendFileSync(this.filename, chunk, { encoding: encoding })
  }

  private _shouldRoll(): void {
    if (this._dateChanged() || this._tooBig()) {
      debug(`rolling because dateChanged? ${this._dateChanged()} or tooBig? ${this._tooBig()}`)
      this._roll()
    }
  }

  private _dateChanged() {
    if (!this.state.currentDate || !this.options.pattern) return false
    return (
      this.state.currentDate && this.state.currentDate !== asString(this.options.pattern, newNow())
    )
  }

  private _tooBig() {
    return this.state.currentSize >= this.options.maxSize
  }

  private _roll() {
    debug(`closing the current stream`)

    const files = this._getExistingFiles()
    const todaysFiles = this.state.currentDate
      ? files.filter((f) => f.date === this.state.currentDate)
      : files

    for (let i = todaysFiles.length - 1; i >= 0; i--) {
      const { filename: sourceName, index: sourceIndex } = todaysFiles[todaysFiles.length - i - 1]

      debug(`analyzing log file: #${i} (${sourceName})`)

      const sourceFilePath = this.fileNameFormatter({
        date: this.state.currentDate,
        index: sourceIndex,
      })

      if (sourceIndex > i) {
        debug(`deleteing out of sequence log file '${sourceName}'`)
        fs.unlinkSync(sourceFilePath)
        continue
      }

      const targetFilePath = this.fileNameFormatter({
        date: this.state.currentDate,
        index: i + 1,
      })

      // we might already have files in the directory that are out of sequence
      // for example, we might have log.txt and log.txt.2, skipping log.txt.1
      // if that's the case, we will delete all remaining log files as they are not re

      // on windows, you can get a EEXIST error if you rename a file to an existing file
      // so, we'll try to delete the file we're renaming to first
      try {
        fs.unlinkSync(targetFilePath)
      } catch (e) {
        // ignore err: if we could not delete, it's most likely that it doesn't exist
      }

      // truncate current file if the it is the first file and no backups are needed
      if (this.options.backups === 0 && i === 0) {
        fs.truncateSync(sourceFilePath, 0)
      }
      // unlimited backups = rename current file
      else if (this.options.backups === undefined) {
        fs.renameSync(sourceFilePath, targetFilePath)
      }
      //
      else if (this.options.backups > i) {
        fs.renameSync(sourceFilePath, targetFilePath)
      } else if (this.options.backups <= i && i > 0) {
        fs.unlinkSync(sourceFilePath)
      }
    }

    this.state.currentSize = 0
    this.state.currentDate =
      this.state.currentDate && this.options.pattern
        ? asString(this.options.pattern, newNow())
        : undefined
    debug(`finished rolling files. state=${JSON.stringify(this.state)}`)
    this._touchFile()
    return
  }

  // Sorted from the oldest to the latest
  private _getExistingFiles() {
    const files = fs.readdirSync(this.fileObject.dir)

    debug(`files=${files}`)
    const existingFileDetails = files.map((n) => this.fileNameParser(n)).filter((n) => !!n)

    // if timestamp exists, use timestamp; otherwise use negative index so that higher index is treated as older file
    const getKey = (n: ParsedFilename) => n.timestamp ?? -n.index
    existingFileDetails.sort((a, b) => getKey(a) - getKey(b))

    debug(`sorted files=${existingFileDetails}`)
    return existingFileDetails
  }

  private _touchFile() {
    const filePath = this.fileNameFormatter({
      date: this.state.currentDate,
      index: 0,
    })

    // attempt to create the directory
    const mkdir = (dir: string) => {
      try {
        return fs.mkdirSync(dir, { recursive: true })
      } catch (e: any) {
        // backward-compatible fs.mkdirSync for nodejs pre-10.12.0 (without recursive option)
        // recursive creation of parent first
        if (e.code === 'ENOENT') {
          mkdir(path.dirname(dir))
          return mkdir(dir)
        }

        // throw error for all except EEXIST and EROFS (read-only filesystem)
        if (e.code !== 'EEXIST' && e.code !== 'EROFS') {
          throw e
        }

        // EEXIST: throw if file and not directory
        // EROFS : throw if directory not found
        else {
          try {
            if (fs.statSync(dir).isDirectory()) {
              return dir
            }
            throw e
          } catch (err) {
            throw e
          }
        }
      }
    }
    mkdir(this.fileObject.dir)

    const ops = {
      // see https://nodejs.org/api/fs.html#file-system-flags
      flags: this.options.flags,
      encoding: this.options.encoding,
      mode:
        typeof this.options.mode === 'string' ? parseInt(this.options.mode, 8) : this.options.mode,
    }

    const { encoding, flags: flag, mode } = ops

    // try to throw EISDIR, EROFS, EACCES
    fs.appendFileSync(filePath, '', { encoding, flag, mode })
  }
}
