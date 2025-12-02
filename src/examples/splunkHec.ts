/*
# create .env file with SPLUNK_COLLECTOR_URL and SPLUNK_HEC_TOKEN env variables

set -o allexport && source .env && set +o allexport
export DEBUG=log4ts:logWriter:splunkHec,log4ts:configure_process,log4ts:logWriter:shutdown
yarn run build && node ./dist/examples/splunkHec.js
*/

import { Logger, SplunkHecLogWriter, SplunkData, LevelName } from '..'

import { configure_process } from './configure_process'

// attach process event listeners and run 100ms before sending SIGINT
// see function configurations to see how process events can be handled
configure_process(0.1)

const baseURL: string | undefined = process.env.SPLUNK_COLLECTOR_URL
const token: string | undefined = process.env.SPLUNK_HEC_TOKEN

if (!baseURL) throw new Error('SPLUNK_COLLECTOR_URL env variable is empty')
if (!token) throw new Error('defined SPLUNK_HEC_TOKEN  env variable is empty')

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
  severity: LevelName
  platform: 'v2'
  loggerName: string
  logWriterName: string
}

type TransformedData = SplunkData<Payload & PayloadLogWriter>

type EventPayload = Omit<SplunkData<Payload>, 'index' | 'time' | 'sourcetype' | 'event'> & Payload

// force users to provide 2 values to log functions: index and event payload
type SplunkLoggerParams = [index: string, event: EventPayload]

const logger = new Logger<SplunkLoggerParams, never>({
  loggerName: 'SplunkLogger',
  level: 'DEBUG',
})

const logWriter = new SplunkHecLogWriter<TransformedData>('SplunkLogWriter', {
  baseURL,
  token,
})

logWriter.register(logger, 'DEBUG', (event, logWriterName, _logWriterConfig) => {
  const index = event.data[0]
  const data = event.data[1]

  const { host, source, ...restData } = data

  const eventPayload: Payload & PayloadLogWriter = {
    ...restData,
    severity: event.level.levelName,
    loggerName: event.loggerName,
    logWriterName,
    platform: 'v2',
  }

  const ret: TransformedData = {
    event: eventPayload,
    host,
    source,
    sourcetype: 'json',
    time: event.startTime.getTime() / 1000,
    index,
  }

  return ret
})

const data: EventPayload = {
  type: 'exec',
  host: 'host-2',
  source: 'worker:demo-create.js',
  origin: 'user',
  message: 'test-project-create:success',
  refid: 'refid-string',
  status: 'success',
  product: 'demo:360',
  product_family: 'demo',
  action: 'create',
  user: 'user@domain.com',
  requested_for: 'user2@domain.com',
  details: {
    messageId: 'messageId-102',
    executionId: 'executionId-103',
    resourceId: 'resourceId-104',
    target: 'test-project-1749',
    dt: new Date(),
  },
}

logger.info('test', data)
