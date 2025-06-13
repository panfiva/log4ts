import debugLib from 'debug'
const debug = debugLib('log4ts:moveFile')

import * as fs from 'fs-extra'
import * as zlib from 'zlib'

/**
 * Interface for the options to control file movement and compression.
 */
export interface MoveAndCompressOptions {
  /**
   * The file mode (permissions) for the target file.
   * Defaults to 0o600 (octal).
   */
  mode?: number | string
  /**
   * Whether to compress the file using gzip during the move.
   * Defaults to false.
   */
  compress?: boolean
}

/**
 * Parses and validates the raw options provided to the function, applying defaults.
 * @param rawOptions The raw options object.
 * @returns The parsed and validated options.
 */
const _parseOption = (rawOptions?: MoveAndCompressOptions): Required<MoveAndCompressOptions> => {
  const defaultOptions: Required<MoveAndCompressOptions> = {
    mode: parseInt('0600', 8), // 0o600 in octal
    compress: false,
  }
  const options: Required<MoveAndCompressOptions> = { ...defaultOptions, ...rawOptions }
  debug(`_parseOption: moveAndMaybeCompressFile called with option=${JSON.stringify(options)}`)
  return options
}

/**
 * Moves a file from a source path to a target path, with an option to compress it.
 * If compression is enabled, the file is gzipped during the move.
 * Handles concurrency by using 'wx' flag for write streams to avoid race conditions.
 * Provides fallback mechanisms for file operations in case of errors.

 */
export const moveAndMaybeCompressFile = async (
  sourceFilePath: string,
  targetFilePath: string,
  optionsParam?: MoveAndCompressOptions
): Promise<void> => {
  const options = _parseOption(optionsParam)

  if (sourceFilePath === targetFilePath) {
    debug(`moveAndMaybeCompressFile: source and target are the same, not doing anything`)
    return
  }

  if (await fs.pathExists(sourceFilePath)) {
    debug(
      `moveAndMaybeCompressFile: moving file from ${sourceFilePath} to ${targetFilePath} ${
        options.compress ? 'with' : 'without'
      } compress`
    )
    if (options.compress) {
      try {
        await new Promise<void>((resolve, reject) => {
          let isCreated = false
          // to avoid concurrency, the forked process which can create the file will proceed (using flags wx)
          const writeStream = fs
            .createWriteStream(targetFilePath, {
              mode: typeof options.mode === 'string' ? parseInt('0600', 8) : options.mode,
              flags: 'wx',
            })
            // wait until writable stream is valid before proceeding to read
            .on('open', () => {
              isCreated = true
              const readStream = fs
                .createReadStream(sourceFilePath)
                // wait until readable stream is valid before piping
                .on('open', () => {
                  readStream.pipe(zlib.createGzip()).pipe(writeStream)
                })
                .on('error', (e: Error) => {
                  debug(`moveAndMaybeCompressFile: error reading ${sourceFilePath}`, e)
                  // manually close writable: https://nodejs.org/api/stream.html#readablepipedestination-options
                  writeStream.destroy(e)
                })
            })
            .on('finish', () => {
              debug(
                `moveAndMaybeCompressFile: finished compressing ${targetFilePath}, deleting ${sourceFilePath}`
              )
              // delete sourceFilePath
              fs.unlink(sourceFilePath)
                .then(resolve)
                .catch((e: Error) => {
                  debug(
                    `moveAndMaybeCompressFile: error deleting ${sourceFilePath}, truncating instead`,
                    e
                  )
                  // fallback to truncate
                  fs.truncate(sourceFilePath)
                    .then(resolve)
                    .catch((e: Error) => {
                      debug(`moveAndMaybeCompressFile: error truncating ${sourceFilePath}`, e)
                      reject(e)
                    })
                })
            })
            .on('error', (e: NodeJS.ErrnoException) => {
              // Use NodeJS.ErrnoException for fs errors
              if (!isCreated) {
                debug(`moveAndMaybeCompressFile: error creating ${targetFilePath}`, e)
                // do not do anything if handled by another forked process
                reject(e)
              } else {
                debug(`moveAndMaybeCompressFile: error writing ${targetFilePath}, deleting`, e)
                // delete targetFilePath (taking as nothing happened)
                fs.unlink(targetFilePath)
                  .then(() => {
                    reject(e)
                  })
                  .catch((err: Error) => {
                    debug(
                      `moveAndMaybeCompressFile: error deleting ${targetFilePath} after write error`,
                      err
                    )
                    reject(err) // Reject with the original error
                  })
              }
            })
        })
      } catch (e) {
        // The Promise is caught inside, so this outer catch might not be strictly necessary
        // unless new Promise rejections are not handled internally.
        // However, adding it defensively to catch any unhandled promise rejections that bubble up.
        debug(`moveAndMaybeCompressFile: unhandled promise rejection during compression`, e)
      }
    } else {
      debug(`moveAndMaybeCompressFile: renaming ${sourceFilePath} to ${targetFilePath}`)
      try {
        await fs.move(sourceFilePath, targetFilePath, { overwrite: true })
      } catch (e: any) {
        // Use any here as error object structure can vary
        debug(`moveAndMaybeCompressFile: error renaming ${sourceFilePath} to ${targetFilePath}`, e)
        /* istanbul ignore else: no need to do anything if file does not exist */
        if (e.code !== 'ENOENT') {
          debug(`moveAndMaybeCompressFile: trying copy+truncate instead`)
          try {
            await fs.copy(sourceFilePath, targetFilePath, { overwrite: true })
            await fs.truncate(sourceFilePath)
          } catch (copyTruncateError: any) {
            debug(`moveAndMaybeCompressFile: error copy+truncate`, copyTruncateError)
          }
        }
      }
    }
  }
}
