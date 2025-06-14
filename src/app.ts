import { configure_process } from './examples/configure_process'

import {
  Logger,
  MultiFileLogWriter,
  MultiFileLogWriterOptions,
  LevelName,
  LoggerArg,
  TransformerFn,
} from './'

// attach process event listeners and run 30 seconds
configure_process(300)

// send SIGINT
// setTimeout(() => {
//   process.kill(process.pid, 'SIGINT')
// }, 500)

type LoggerPayload = (string | number | boolean)[]

const logger1 = new Logger<LoggerPayload, { filename: string }>({
  loggerName: 'logger1',
  level: 'DEBUG',
  context: { filename: 'test1.log' },
})
logger1.addContext('filename', 'test.log')

// const logger2 = new Logger<LoggerPayload, { filename: string }>({
//   loggerName: 'logger2',
//   level: 'DEBUG',
//   context: { filename: 'test2.log' },
// })
// logger2.addContext('filename', 'test.log')

const logWriter = new MultiFileLogWriter('writer', { baseDir: './logs', timeout: 500 })

logWriter.attachToLogger(logger1, 'DEBUG', (event, _logWriterName, _logWriterConfig) => {
  const param = event.payload.data

  const filename: string = event.payload.context?.filename as string

  return { filename: filename, data: param.join(',') }
})

let i = 0
const intervalId = setInterval(() => {
  i++
  logger1.info('test1', `message ${i} ${new Date().toISOString()}`)
  logger1.info('test2', `message ${i} ${new Date().toISOString()}`)
  logger1.info('test3', `message ${i} ${new Date().toISOString()}`)
  logger1.info('test4', `message ${i} ${new Date().toISOString()}`)
  logger1.info('test5', `message ${i} ${new Date().toISOString()}`)
  logger1.info('test6', `message ${i} ${new Date().toISOString()}`)
  logger1.info('test7', `message ${i} ${new Date().toISOString()}`)
  logger1.info('test8', `message ${i} ${new Date().toISOString()}`)

  if (i === 3) {
    clearInterval(intervalId)
  }
}, 1000)

// let i = 0
// const intervalId = setInterval(() => {
//   i++
//   if (i < 3 || i > 7) {
//     logger1.info('test1', `message ${i} ${new Date().toISOString()}`)
//     // logger2.info('test2', `message ${i} ${new Date().toISOString()}`)
//   }
//   if (i === 10) {
//     clearInterval(intervalId)
//   }
// }, 1000)
