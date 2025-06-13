import { configure_process } from './examples/configure_process'

import { Logger, SplunkHecLogWriter, SplunkData, LevelName } from './'

// attach process event listeners and run 30 seconds
configure_process(30)

const baseURL: string | undefined = process.env.SPLUNK_COLLECTOR_URL
const token: string | undefined = process.env.SPLUNK_HEC_TOKEN

if (!baseURL) throw new Error('SPLUNK_COLLECTOR_URL env variable is empty')
if (!token) throw new Error('defined SPLUNK_HEC_TOKEN  env variable is empty')

// send SIGINT after 2 seconds to demostrate event handlers
// see configure_process
setTimeout(() => {
  process.kill(process.pid, 'SIGINT')
}, 2 * 1000)

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

type SplunkLogWriterData = SplunkData<Payload & PayloadLogWriter>

type SplunkLoggerData = Omit<SplunkData<Payload>, 'index' | 'time' | 'sourcetype' | 'event'> &
  Payload

type SplunkLoggerParams = [index: string, event: SplunkLoggerData]

const logger = new Logger<SplunkLoggerParams>({
  loggerName: 'SplunkLogger',
  level: 'DEBUG',
})

const logWriter = new SplunkHecLogWriter<SplunkLogWriterData>('SplunkLogWriter', {
  baseURL,
  token,
})

logWriter.attachToLogger(logger, 'DEBUG', (event, logWriterName, _logWriterConfig) => {
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
})

const data: SplunkLoggerData = {
  type: 'exec',
  host: 'host-2',
  source: 'consumer-server:ezdemo-create.js',
  origin: 'user',
  message: 'ec2-workspace-create:success',
  refid: 'refid-string',
  status: 'success',
  product: 'ezdemo:demo:360',
  product_family: 'ezdemo',
  action: 'create',
  user: 'user@domain.com',
  requested_for: 'user2@domain.com',
  details: {
    messageId: 'messageId-102',
    executionId: 'executionId-103',
    resourceId: 'resourceId-104',
    target: 'ec2-workspace-1749',
  },
}

logger.info('test', data)
