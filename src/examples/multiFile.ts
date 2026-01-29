import {
  Logger,
  Layout,
  LogEvent,
  MultiFileLogWriter,
  MultiFileLogWriterConfig,
  MultiFileLogWriterParam,
} from '..'

import { configure_process } from './configure_process'

// attach process event listeners and run 6 seconds before sending SIGINT
// see function configurations to see how process events can be handled
configure_process(6)

const options: MultiFileLogWriterConfig = {
  baseDir: './logs',
  // file stream will close 2 seconds after last event
  // file stream will reopen if a new event is received
  timeout: 2000, // change this to undefined or 10000 to see how sequence of events changes
  maxLogSize: 1400,
  backups: 1,
}

type LogWriterParam = MultiFileLogWriterParam
type LogWriterConfig = MultiFileLogWriterConfig

// file name will be set from context
type LoggerArgs1 = (string | number | boolean | object)[]
type LoggerReturn1 = LoggerArgs1
type LoggerContext1 = { filename: string }

const logWriter = new MultiFileLogWriter('writer-name', options)

class SampleLogger1 extends Logger<LoggerArgs1, LoggerContext1, LoggerReturn1> {
  getLogData(...args: LoggerArgs1): LoggerReturn1 {
    return args
  }
}

// Example 1 - Add file name using context during logger creation
// context value will be used in layoutFn
const logger1 = new SampleLogger1({
  loggerName: 'file-from-context',
  level: 'DEBUG',
  context: { filename: 'test1.log' },
})

class SampleLayout1 extends Layout<LoggerReturn1, LogWriterParam, LoggerContext1, LogWriterConfig> {
  format(event: LogEvent<LoggerReturn1, LoggerContext1>): LogWriterParam {
    const param = event.data
    const filename: string = event.context.filename
    return { filename: filename, data: param.join(': ') }
  }
}

logWriter.register(logger1.loggerName, 'DEBUG', SampleLayout1)

// one parameter with data and filename
type LoggerArgs2 = [{ filename: string; data: (string | number | boolean | object)[] }]
type LoggerReturn2 = LoggerArgs2
type LoggerContext2 = never

class SampleLogger2 extends Logger<LoggerArgs2, LoggerContext2, LoggerReturn1> {
  getLogData(...args: LoggerArgs2): LoggerReturn1 {
    return args
  }

  getLogError(...args: LoggerArgs2): Error | undefined {
    const payload = args[0]
    const data = payload.data
    const error = data.find((item: any) => item instanceof Error)
    return error
  }
}

const logger2 = new SampleLogger2({
  loggerName: 'file-from-data',
  level: 'DEBUG',
})

class SampleLayout2 extends Layout<LoggerReturn2, LogWriterParam, LoggerContext2, LogWriterConfig> {
  format(event: LogEvent<LoggerReturn2, LoggerContext2>): LogWriterParam {
    const param = event.data[0].data
    const filename: string = event.data[0].filename
    return { filename: filename, data: param.join(': ') }
  }
}

logWriter.register(logger2.loggerName, 'DEBUG', SampleLayout2)

logger1.addContext('filename', 'test1.log')
logger1.info(`logger1`, `filename context test1.log`, `${new Date().toISOString()}`)

logger1.addContext('filename', 'test2.log')
logger1.info(`logger1`, `filename context test2.log`, `${new Date().toISOString()}`)

logger2.info({
  data: [`logger2`, `filename data test1.log`, `${new Date().toISOString()}`],
  filename: 'test1.log',
})

logger2.info({
  data: [`logger2`, `filename data test2.log`, `${new Date().toISOString()}`],
  filename: 'test2.log',
})
