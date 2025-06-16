import debugLib from 'debug'
const debug = debugLib('log4ts:fileNameParser')

import { asString, parse } from 'date-format'

const ZIP_EXT = '.gz'
const DEFAULT_FILENAME_SEP = '.'
const __NOT_MATCHING__ = '__NOT_MATCHING__'

import type { ParsedFilename, FileNameParserFn, FileNameParserOptions } from './types'

// export interface FileInfo {
//   name: string
//   ext: string
//   base: string
// }

/** functions that return filename with the part removed */
type FileNameParserHelper = (f: string, p: ParsedFilename) => string

export const fileNameParserFactory = (props: FileNameParserOptions): FileNameParserFn => {
  const { file, keepFileExt, pattern, fileNameSep } = props

  const FILENAME_SEP = fileNameSep || DEFAULT_FILENAME_SEP

  // All these functions take two arguments: f, the filename, and p, the result placeholder
  // They return the filename with any matching parts removed.
  // The "zip" function, for instance, removes the ".gz" part of the filename (if present)
  const zip: FileNameParserHelper = (f, p) => {
    if (f.endsWith(ZIP_EXT)) {
      debug('it is gzipped')
      // eslint-disable-next-line no-param-reassign
      p.isCompressed = true
      return f.slice(0, -1 * ZIP_EXT.length)
    }
    return f
  }

  const extAtEnd: FileNameParserHelper = (f, _p): string => {
    if (f.startsWith(file.name) && f.endsWith(file.ext)) {
      debug('it starts and ends with the right things')
      // The `+ 1` accounts for the separator character between name and extension
      return f.slice(file.name.length + 1, -1 * file.ext.length)
    }
    return __NOT_MATCHING__
  }

  const extInMiddle: FileNameParserHelper = (f, _p): string => {
    if (f.startsWith(file.base)) {
      debug('it starts with the right things')
      // The `+ 1` accounts for the separator character after the base name
      return f.slice(file.base.length + 1)
    }
    return __NOT_MATCHING__
  }

  const dateAndIndex: FileNameParserHelper = (f, p) => {
    const items = f.split(FILENAME_SEP)
    let indexStr = items[items.length - 1]
    debug('items: ', items, ', indexStr: ', indexStr)
    let dateStr = f

    if (indexStr !== undefined && indexStr.match(/^\d+$/)) {
      dateStr = f.slice(0, -1 * (indexStr.length + 1))
      debug(`dateStr is ${dateStr}`)
      if (pattern && !dateStr) {
        dateStr = indexStr
        indexStr = '0' // If pattern is present and dateStr is empty, the index part might be the date.
      }
    } else {
      indexStr = '0' // No explicit index found, default to 0.
    }

    try {
      // Two arguments for new Date() are intentional. This will set other date
      // components to minimal values in the current timezone instead of UTC,
      // as new Date(0) will do.
      // We need to assert 'pattern' as it's optional in FileNameParserOptions but required here.
      // The outer conditional `pattern ? dateAndIndex : index` ensures `pattern` exists.
      const date = parse(pattern as string, dateStr, new Date(0, 0))
      if (asString(pattern as string, date) !== dateStr) {
        return f // The parsed date doesn't match the original string, so it's not a valid match.
      }
      // eslint-disable-next-line no-param-reassign
      p.index = parseInt(indexStr, 10)
      // eslint-disable-next-line no-param-reassign
      p.date = dateStr
      // eslint-disable-next-line no-param-reassign
      p.timestamp = date.getTime()
      return '' // All parts consumed
    } catch (e) {
      //not a valid date, don't panic.
      debug(`Problem parsing ${dateStr} as ${pattern}, error was: `, e)
      return f // Not a valid date, return the original string to indicate no match.
    }
  }

  const index: FileNameParserHelper = (f, p) => {
    if (f.match(/^\d+$/)) {
      debug('it has an index')
      // eslint-disable-next-line no-param-reassign
      p.index = parseInt(f, 10)
      return '' // All parts consumed
    }
    return f // Not an index, return the original string to indicate no match.
  }

  const parts: FileNameParserHelper[] = [
    zip,
    keepFileExt ? extAtEnd : extInMiddle,
    pattern ? dateAndIndex : index,
  ]

  const ret: FileNameParserFn = (filename) => {
    const result: ParsedFilename = {
      filename,
      index: 0,
      isCompressed: false,
    }
    // pass the filename through each of the file part parsers
    const whatsLeftOver = parts.reduce((remains, part) => part(remains, result), filename)
    // if there's anything left after parsing, then it wasn't a valid filename

    return whatsLeftOver ? null : result
  }

  return ret
}
