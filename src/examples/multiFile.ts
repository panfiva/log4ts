/*
export DEBUG=log4ts:logWriter:multiFileLogWriter,log4ts:logWriter:shutdown,log4ts:logWriter:file
yarn run build && node ./dist/examples/multiFile.js
*/

import { Logger, MultiFileLogWriter, MultiFileLogWriterOptions, TransformerFnInferred } from '..'

import { configure_process } from './configure_process'

// attach process event listeners and run 6 seconds before sending SIGINT
// see function configurations to see how process events can be handled
configure_process(6)

const options: MultiFileLogWriterOptions = {
  baseDir: './logs',
  // file stream will close 2 seconds after last event
  // file stream will reopen if a new event is received
  timeout: 2000, // change this to undefined or 10000 to see how sequence of events changes
  maxLogSize: 1400,
  backups: 1,
}

const logWriter = new MultiFileLogWriter('writer-name', options)

/** one or more arguments of string, number or boolean type */
type LoggerPayload = (string | number | boolean)[]

// Example 1 - Add file name using context during logger creation
// context value will be used in transformerFn
const logger1 = new Logger<LoggerPayload, { filename: string }>({
  loggerName: 'logger-name-1',
  level: 'DEBUG',
  context: { filename: 'test1.log' },
})

// Example 1 - Add file name using context that is defined after logger is created
// context value will be used in transformerFn
const logger2 = new Logger<LoggerPayload, { filename: string }>({
  loggerName: 'logger-name-2',
  level: 'DEBUG',
})
logger2.addContext('filename', 'test2.log')

// `TransformerFnInferred` is used to infer transform function parameters:
// `event`, `_logWriterName`, `_logWriterConfig`
// Can also use `TransformerFn` but it requires more input
const transformerFn: TransformerFnInferred<typeof logger1, typeof logWriter> = (
  event,
  _logWriterName,
  _logWriterConfig
) => {
  const param: (string | number | boolean)[] = event.data
  const filename: string = event.context?.filename as string
  return { filename: filename, data: param.join(': ') }
}

logWriter.attachToLogger(logger1, 'DEBUG', transformerFn)
logWriter.attachToLogger(logger2, 'DEBUG', transformerFn)

/** only one argument {filename, data} is accepted */
type LoggerPayload3 = [{ fileName: string; data: string | number | boolean | Record<string, any> }]

// Example 3 - send filename inside logger call payload
const logger3 = new Logger<LoggerPayload3>({
  loggerName: 'logger-name-3',
  level: 'DEBUG',
})

// TransformerFnInferred is used to infer transform function parameters
// `event`, `_logWriterName`, `_logWriterConfig`
// Can also use `TransformerFn` but it requires more input
const transformerFn3: TransformerFnInferred<typeof logger3, typeof logWriter> = (
  event,
  _logWriterName,
  _logWriterConfig
) => {
  // only one param is supported due to LoggerPayload3
  const d = event.data[0]

  const data: string = typeof d.data === 'object' ? JSON.stringify(d.data) : d.data.toString()

  const filename: string = d.fileName
  return { filename: filename, data: data }
}

logWriter.attachToLogger(logger3, 'DEBUG', transformerFn3)

logger1.info(`logger 1 message`, `${new Date().toISOString()}`)
logger2.info(`logger 2 message`, `${new Date().toISOString()}`)
logger3.info({ fileName: 'test1.log', data: `logger 3.1 message: ${new Date().toISOString()}` })
logger3.info({ fileName: 'test2.log', data: `logger 3.2 message: ${new Date().toISOString()}` })
