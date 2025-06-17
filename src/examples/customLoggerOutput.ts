/*
export DEBUG=
yarn run build && node ./dist/examples/customLoggerOutput.js
*/

import { Logger, ConsoleLogWriter } from '..'

import { configure_process } from './configure_process'

// attach process event listeners and run 2 seconds before sending SIGINT
// see function configurations to see how process events can be handled
configure_process(2)

type TMain = [string]
type TCustom = [{ data: string; type: 't1' | 't2' }]

const logger = new Logger<TMain>({ loggerName: 'L', level: 'INFO' })
const writer = new ConsoleLogWriter('W2')

writer.register(logger, 'INFO', (event, _writerName, _writerConfig) => {
  return [event.data[0].concat('!')]
})

class Logger2 extends Logger<TCustom, never, TMain> {
  // must return same data type as returned by the main class
  transform = (...data: TCustom): TMain => {
    return [JSON.stringify(data[0])]
  }
}

// must use the same class name as parent class
// do NOT register this class with any event listeners since parent is registered
const logger2 = new Logger2({ loggerName: logger.loggerName, level: 'INFO' })

logger.info('test1')
logger2.info({ data: 'test2', type: 't2' })
