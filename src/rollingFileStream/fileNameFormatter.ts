import debugLib from 'debug'
const debug = debugLib('log4ts:fileNameFormatter')

import path from 'path'
import type { FileNameFormatterOptions, FileNameFormatterFn } from './types'

const ZIP_EXT = '.gz'
const DEFAULT_FILENAME_SEP = '.'

type FormatterPart = (filename: string, index: number, date: string | undefined) => string

export const fileNameFormatterFactory = (props: FileNameFormatterOptions): FileNameFormatterFn => {
  const { file, keepFileExt, needsIndex, alwaysIncludeDate, compress, fileNameSep } = props
  const FILENAME_SEP = fileNameSep || DEFAULT_FILENAME_SEP
  const dirAndName = path.join(file.dir, file.name)

  const ext: FormatterPart = (f) => {
    return f + file.ext
  }

  const index: FormatterPart = (f, i, d) => {
    const ret = (needsIndex || !d) && i ? f + FILENAME_SEP + i : f
    return ret
  }

  const date: FormatterPart = (f, i, d) => {
    const ret = d && (i > 0 || alwaysIncludeDate) ? f + FILENAME_SEP + d : f
    return ret
  }

  const gzip: FormatterPart = (f, i) => {
    const ret = i && compress ? f + ZIP_EXT : f
    return ret
  }

  const parts: FormatterPart[] = keepFileExt ? [date, index, ext, gzip] : [ext, date, index, gzip]

  const fn: FileNameFormatterFn = (props) => {
    const { date, index } = props
    debug(`_formatFileName: date=%s, index=%d`, date, index) // Use %s and %d for debug placeholders
    const ret = parts.reduce((filename, part) => part(filename, index, date), dirAndName)
    return ret
  }

  return fn
}
