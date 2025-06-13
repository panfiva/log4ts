import debugLib from 'debug'
const debug = debugLib('log4ts:RollingFileWriteStream')

import * as fs from 'fs-extra'
import * as path from 'path'
import * as os from 'os'
import { Writable } from 'stream'

import { fileNameFormatterFactory } from './fileNameFormatter'
import { fileNameParserFactory } from './fileNameParser'
import { moveAndMaybeCompressFile } from './moveFile'

import type {
  FileNameFormatterFn,
  RollingFileWriteStreamOptions,
  FileNameParserFn,
  ParsedFilename,
} from './types'

import type { PartialBy } from '../types'

import { asString } from 'date-format'

const newNow = () => new Date()

const deleteFiles = (fileNames: string[]) => {
  debug(`deleteFiles: files to delete: ${fileNames}`)
  return Promise.all(
    fileNames.map((f) =>
      fs.unlink(f).catch((e) => {
        debug(`deleteFiles: error when unlinking ${f}, ignoring. Error was ${e}`)
      })
    )
  )
}

type RollingFileWriteStreamConfigs = PartialBy<Required<RollingFileWriteStreamOptions>, 'pattern'>

/**
 * RollingFileWriteStream is mainly used when writing to a file rolling by date or size.
 * RollingFileWriteStream inherits from stream.Writable
 */
export class RollingFileWriteStream extends Writable {
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

  options: RollingFileWriteStreamConfigs

  constructor(filePath: string, options: RollingFileWriteStreamOptions) {
    debug(`constructor: creating RollingFileWriteStream. path=${filePath}`)
    if (typeof filePath !== 'string' || filePath.length === 0) {
      throw new Error(`Invalid filename: ${filePath}`)
    } else if (filePath.endsWith(path.sep)) {
      throw new Error(`Filename is a directory: ${filePath}`)
    }

    super()

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
      compress: this.options.compress,
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
    this._renewWriteStream()
  }

  _setExistingSizeAndDate() {
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

  private _parseOption(rawOptions: RollingFileWriteStreamOptions): RollingFileWriteStreamConfigs {
    const defaultOptions: RollingFileWriteStreamConfigs = {
      maxSize: 0,
      backups: 4,
      encoding: 'utf8',
      mode: parseInt('0600', 8), // 0o600 in octal
      flags: 'a',
      compress: false,
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
    debug(`_parseOption: creating stream with option=${JSON.stringify(options)}`)
    return options
  }

  /** overwrite Stream._final */
  _final(callback: (error?: Error | null) => void): void {
    this.currentFileStream.end('', this.options.encoding, callback)
  }

  /** overwrite Stream._write */
  _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this._shouldRoll().then(() => {
      debug(
        `_write: writing chunk. ` +
          `file=${this.currentFileStream.path} ` +
          `state=${JSON.stringify(this.state)} ` +
          `chunk=${chunk}`
      )
      this.currentFileStream.write(chunk, encoding, (e) => {
        this.state.currentSize += chunk.length
        callback(e)
      })
    })
  }

  private async _shouldRoll() {
    if (this._dateChanged() || this._tooBig()) {
      debug(
        `_shouldRoll: rolling because dateChanged? ${this._dateChanged()} or tooBig? ${this._tooBig()}`
      )
      await this._roll()
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
    debug(`_roll: closing the current stream`)
    return new Promise((resolve, reject) => {
      this.currentFileStream.end('', this.options.encoding, () => {
        this._moveOldFiles().then(resolve).catch(reject)
      })
    })
  }

  private async _moveOldFiles() {
    const files = await this._getExistingFiles()
    const todaysFiles = this.state.currentDate
      ? files.filter((f) => f.date === this.state.currentDate)
      : files
    for (let i = todaysFiles.length; i >= 0; i--) {
      debug(`_moveOldFiles: i = ${i}`)
      const sourceFilePath = this.fileNameFormatter({
        date: this.state.currentDate,
        index: i,
      })
      const targetFilePath = this.fileNameFormatter({
        date: this.state.currentDate,
        index: i + 1,
      })

      const moveAndCompressOptions = {
        compress: this.options.compress && i === 0,
        mode: this.options.mode,
      }
      await moveAndMaybeCompressFile(sourceFilePath, targetFilePath, moveAndCompressOptions)
    }

    this.state.currentSize = 0
    this.state.currentDate =
      this.state.currentDate && this.options.pattern
        ? asString(this.options.pattern, newNow())
        : undefined
    debug(`_moveOldFiles: finished rolling files. state=${JSON.stringify(this.state)}`)
    this._renewWriteStream()
    // wait for the file to be open before cleaning up old ones,
    // otherwise the daysToKeep calculations can be off
    await new Promise((resolve, reject) => {
      this.currentFileStream.write('', this.options.encoding, () => {
        this._clean().then(resolve).catch(reject)
      })
    })
  }

  // Sorted from the oldest to the latest
  private async _getExistingFiles() {
    const files = await fs
      .readdir(this.fileObject.dir)
      .catch(/* istanbul ignore next: will not happen on windows */ () => [])

    debug(`_getExistingFiles: files=${files}`)
    const existingFileDetails = files.map((n) => this.fileNameParser(n)).filter((n) => !!n)

    const getKey = (n: ParsedFilename) => (n.timestamp ? n.timestamp : newNow().getTime()) - n.index
    existingFileDetails.sort((a, b) => getKey(a) - getKey(b))

    return existingFileDetails
  }

  private _renewWriteStream() {
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
    this.currentFileStream = fs.createWriteStream(filePath, ops)
    this.currentFileStream.on('error', (e) => {
      this.emit('error', e)
    })
  }

  private async _clean() {
    const existingFileDetails = await this._getExistingFiles()
    debug(
      `_clean: backups = ${this.options.backups}, existingFiles = ${existingFileDetails.length}`
    )
    debug('_clean: existing files are: ', existingFileDetails)
    if (this._tooManyFiles(existingFileDetails.length)) {
      const fileNamesToRemove = existingFileDetails
        .slice(0, existingFileDetails.length - this.options.backups - 1)
        .map((f) => path.format({ dir: this.fileObject.dir, base: f.filename }))

      await deleteFiles(fileNamesToRemove)
    }
  }

  _tooManyFiles(numFiles: number) {
    return this.options.backups >= 0 && numFiles > this.options.backups + 1
  }
}
