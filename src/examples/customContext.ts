/*
export DEBUG=
yarn run build && node ./dist/examples/customContext.js
*/

import { Logger, ConsoleLogWriter } from '..'

import { configure_process } from './configure_process'

// attach process event listeners and run 2 seconds before sending SIGINT
// see function configurations to see how process events can be handled
configure_process(2)

const logger = new Logger({ loggerName: 'L', level: 'INFO', context: { label: 'test' } })
const writer = new ConsoleLogWriter('W2')

writer.register(logger, 'INFO', (event, _writerName, _writerConfig) => {
  const { data, startTime, context } = event
  return [{ data, startTime, context }]
})

const logger2 = new Logger({
  loggerName: logger.loggerName,
  level: 'INFO',
  context: { custom: 'test' },
})

logger.info('test1')
logger2.info('test2')
logger.info('test3')
