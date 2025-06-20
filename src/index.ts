export { LogWriter, ShutdownCb } from './logWriter'
export { FileLogWriter, FileLogWriterConfig } from './logWriters/fileLogWriter'
export { ConsoleLogWriter } from './logWriters/consoleLogWriter'
export { MultiFileLogWriter, MultiFileLogWriterOptions } from './logWriters/multiFileLogWriter'
export {
  SplunkHecLogWriter,
  SplunkHecLogWriterConfig,
  SplunkData,
} from './logWriters/splunkHecLogWriter'
export { Logger, TransformFunctionReturn } from './logger'
export { getLevelRegistry } from './level'
export type * from './types'
export { shutdown } from './eventBus'

export { toPlainObject } from './utils/toPlainObject'
export { transformAxiosError } from './utils/transformAxiosError'
