import {
  Logger,
  Layout,
  LogEvent,
  MultiFileLogWriter,
  MultiFileLogWriterConfig,
  MultiFileLogWriterParam,
  BuildEventDataResult,
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
type LoggerReturnContext1 = LoggerContext1

const logWriter = new MultiFileLogWriter('writer-name', options)

class SampleLogger1 extends Logger<
  LoggerArgs1,
  LoggerContext1,
  LoggerReturn1,
  LoggerReturnContext1
> {
  buildEventPayload(
    ...args: LoggerArgs1
  ): BuildEventDataResult<LoggerReturn1, LoggerReturnContext1> {
    return {
      data: args,
      context: this.context,
      error: this.getFirstError(...args),
    }
  }
}

// Example 1 - Add file name using context during logger creation
// context value will be used in layoutFn
const logger1 = new SampleLogger1({
  loggerName: 'file-from-context',
  level: 'DEBUG',
  context: { filename: 'test1.log' },
})

class SampleLayout1 extends Layout<
  LoggerReturn1,
  LogWriterParam,
  LoggerReturnContext1,
  LogWriterConfig
> {
  format(event: LogEvent<LoggerReturn1, LoggerReturnContext1>): LogWriterParam {
    const param = event.data
    const filename: string = event.context.filename
    return { filename: filename, data: param.join(': ') }
  }
}
const layout1 = new SampleLayout1({
  loggerName: logger1.loggerName,
  logWriterName: logWriter.name,
  logWriterConfig: logWriter.config,
})
logWriter.register(logger1.loggerName, 'DEBUG', layout1)

// one parameter with data and filename
type LoggerArgs2 = [{ filename: string; data: (string | number | boolean | object)[] }]
type LoggerReturn2 = LoggerArgs2
type LoggerContext2 = any
type LoggerReturnContext2 = any

class SampleLogger2 extends Logger<
  LoggerArgs2,
  LoggerContext2,
  LoggerReturn2,
  LoggerReturnContext2
> {
  buildEventPayload(
    ...args: LoggerArgs2
  ): BuildEventDataResult<LoggerReturn2, LoggerReturnContext2> {
    return {
      data: args,
      context: this.context,
      error: this.getFirstError(...args),
    }
  }

  getFirstError(...args: LoggerArgs2): Error | undefined {
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

class SampleLayout2 extends Layout<
  LoggerReturn2,
  LogWriterParam,
  LoggerReturnContext2,
  LogWriterConfig
> {
  format(event: LogEvent<LoggerReturn2, LoggerReturnContext2>): LogWriterParam {
    const param = event.data[0].data
    const filename: string = event.data[0].filename
    return { filename: filename, data: param.join(': ') }
  }
}
const layout2 = new SampleLayout2({
  loggerName: logger2.loggerName,
  logWriterName: logWriter.name,
  logWriterConfig: logWriter.config,
})
logWriter.register(logger2.loggerName, 'DEBUG', layout2)

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
