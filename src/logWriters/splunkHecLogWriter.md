# Splunk HEC LogWriter usage example

```ts
import debugLib from 'debug'
const debug = debugLib('log4ts:app')

import { createLogger, SplunkHecLogWriter, SplunkData, shutdown, LevelName } from './'

type LevelNames = LevelName
type LoggerNames = 'SplunkLogger'
type LogWriterNames = 'SplunkLogWriter'

type Payload = {
  origin: 'user' | 'service'
  message: string
  product: string
  product_family: string
  refid: string
  details?: Record<string, any>
} & (
  | { type: 'log' }
  | {
      type: 'exec'
      action: string
      status: 'failed' | 'success'
      user: string
      requested_for?: string
    }
)

type PayloadLogWriter = {
  severity: LevelNames
  platform: 'v2'
  loggerName: string
  logWriterName: string
}

type SplunkLogWriterData = SplunkData<Payload & PayloadLogWriter>

type SplunkLoggerData = Omit<SplunkData<Payload>, 'index' | 'time' | 'sourcetype' | 'event'> &
  Payload

type SplunkLoggerParams = [index: string, event: SplunkLoggerData]

const baseURL: string = process.env.SPLUNK_COLLECTOR_URL!
const token: string = process.env.SPLUNK_HEC_TOKEN!

const logWriter = new SplunkHecLogWriter<SplunkLogWriterData, LogWriterNames>('SplunkLogWriter', {
  baseURL,
  token,
})

logWriter.attachToLogger<LoggerNames, LevelNames, SplunkLoggerParams>(
  'SplunkLogger',
  'DEBUG',
  (event, logWriterName, _logWriterConfig) => {
    const index = event.payload.data[0]
    const data = event.payload.data[1]

    const { host, source, ...restData } = data

    const eventPayload: Payload & PayloadLogWriter = {
      ...restData,
      severity: event.payload.level.levelName,
      loggerName: event.payload.loggerName,
      logWriterName,
      platform: 'v2',
    }

    const ret: SplunkLogWriterData = {
      event: eventPayload,
      host,
      source,
      sourcetype: 'json',
      time: Math.floor(event.payload.startTime.getTime() / 1000),
      index,
    }

    return ret
  }
)

const logger = createLogger<SplunkLoggerParams, LevelNames, LoggerNames>({
  loggerName: 'SplunkLogger',
  level: 'DEBUG',
})

server()

const data: SplunkLoggerData = {
  type: 'exec',
  host: 'host',
  source: 'consumer-server:ezdemo-create.js',
  origin: 'user',
  message: 'ec2-workspace-create:success',
  refid: 'refid-string',
  status: 'success',
  product: 'ezdemo:demo:ztna-next-360',
  product_family: 'ezdemo',
  action: 'create',
  user: 'user@domain.com',
  requested_for: 'user2@domain.com',
  details: {
    messageId: 'messageId-102',
    executionId: 'executionId-103',
    resourceId: 'resourceId-104',
    target: 'ec2-workspace-1749750526125',
  },
}

// trigger SIGINT - demo purposes only to illustrate how process.on handler work
setTimeout(() => {
  logger.info('test', { ...data, message: '1' })
  process.kill(process.pid, 'SIGINT')
}, 2 * 1000)

function server() {
  const handleExit = (
    reason: 'SIGINT' | 'SIGTERM' | 'uncaughtException' | 'unhandledRejection'
  ) => {
    if (['uncaughtException', 'unhandledRejection'].includes(reason)) {
      console.error(`exit signal: ${reason}`)
    } else {
      console.log(`exit signal: ${reason}`)
    }

    shutdown(() => {
      process.exit(1)
    })
  }

  process.on('unhandledRejection', (reason: Error) => {
    debug('process.on.unhandledRejection')
    try {
      console.error('process.on.unhandledRejection', reason)
    } catch (err) {
      console.error(reason)
    }

    handleExit('unhandledRejection')
  })

  process.on('SIGINT', () => handleExit('SIGINT'))

  process.on('SIGTERM', () => handleExit('SIGTERM'))

  process.on('uncaughtException', (err: Error, _origin: any) => {
    debug('process.on.uncaughtException')

    try {
      console.error('process.on.uncaughtException', err, _origin)
    } catch (e) {
      console.error(e)
    }

    handleExit('uncaughtException')
  })

  // keep the process running - demo purposes keep process running for 30 seconds
  setTimeout(() => {}, 30 * 1000)
}
```
