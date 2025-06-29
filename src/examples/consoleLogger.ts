/*
export DEBUG=
yarn run build && node ./dist/examples/consoleLogger.js
*/

import { Logger, ConsoleLogWriter } from '..'
import { formatWithOptions, styleText } from 'node:util'

const logger = new Logger<any[]>({
  loggerName: 'console-logger',
  level: 'TRACE',
})

const writer = new ConsoleLogWriter('console-writer')

writer.register(logger, 'TRACE', (event, _logWriterName, _logWriterConfig) => {
  const data = [...event.data]

  const objectCollors: boolean = true
  const colorBySev: boolean = true
  const depth: number | null = 3
  const out: string[] = []
  for (const v of data) {
    const v2 = typeof v === 'number' || typeof v === 'boolean' ? v.toString() : v
    const isSevColor = colorBySev && typeof v2 === 'string'
    let str = formatWithOptions({ colors: objectCollors, depth, compact: true }, v2)
    if (isSevColor) str = styleText(event.level.color, str)
    out.push(str)
  }

  return out
})

const obj = { a: { b: { c: [1, 2, 3, 4], e: { f: [1, 2, 3, 4] } } } }
logger.trace('TRACE event', obj)
logger.debug('DEBUG event', obj)
logger.info('INFO event', obj)
logger.warn('WARN event', obj)
logger.error('ERROR event', obj)
logger.fatal('FATAL event', obj)
