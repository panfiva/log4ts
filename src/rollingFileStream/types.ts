import path from 'path'

export type FileNameFormatterOptions = {
  file: path.ParsedPath
  keepFileExt: boolean
  needsIndex: boolean
  alwaysIncludeDate: boolean
  compress: boolean
  fileNameSep?: string
}

export type FileNameParserOptions = {
  file: path.ParsedPath
  keepFileExt?: boolean
  pattern?: string
  fileNameSep?: string
}

type FormattersInput = {
  date: string | undefined
  index: number
}

export type ParsedFilename = {
  filename: string
  index: number
  isCompressed: boolean
  date?: string
  timestamp?: number
}

export type FileNameFormatterFn = (props: FormattersInput) => string

export type FileNameParserFn = (f: string, p?: ParsedFilename) => ParsedFilename | null

/**
 * Options for the RollingFileWriteStream constructor.
 */
export type RollingFileWriteStreamOptions = {
  /**
   * The maximum number of files to keep.
   */
  backups?: number
  /**
   * The maximum size one file can reach, in bytes.
   * This should be more than 1024. The default is 0.
   * If not specified or 0, then no log rolling will happen.
   */
  maxSize?: number
  /**
   * The mode of the files. The default is 0o600 in octal.
   * Refer to stream.writable for more.
   */
  mode?: string | number
  /**
   * The default is 'a'. Refer to stream.flags for more.
   * https://nodejs.org/api/fs.html#file-system-flags
   */
  flags?: string
  /**
   * Whether to compress backup files.
   */
  compress?: boolean
  /**
   * Whether to keep the file extension.
   */
  keepFileExt?: boolean
  /**
   * The date string pattern in the file name.
   * Example: `yyyy-MM-ddThh:mm:ss.SS`
   */
  pattern?: string
  /**
   * Whether to add date to the name of the first file.
   */
  alwaysIncludePattern?: boolean

  encoding?: BufferEncoding

  /** File name separator */
  fileNameSep?: string
}
