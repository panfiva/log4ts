import debugLib from 'debug'
const debug = debugLib('log4ts:clustering')

import EventEmitter from 'eventemitter3'

import { Worker, Cluster } from 'cluster'
import type { LoggingEvent } from './loggingEvent'
import type { LevelName, LoggerArg } from './types'
import type { LogWriter, ShutdownCb } from './logWriterClass'
import type { Logger } from './logger'

let _cluster: Cluster | false | undefined = undefined
let _eventBus: EventBus | undefined = undefined

export type EventListenerConfig<
  TData extends Array<LoggerArg>,
  TContext extends Record<string, any>,
  TFormattedData,
  TConfigA extends Record<string, any>,
> = {
  loggerName: string
  levelName: LevelName
  listener: (event: LoggingEvent<TData, TContext>) => void
  logger: Logger<TData, TContext>
  logWriter: LogWriter<TFormattedData, TConfigA>
}

let _promise: Promise<EventBus> | undefined

export async function getEventBus(): Promise<EventBus> {
  if (_promise) {
    return _promise
  }

  const fn = async (): Promise<EventBus> => {
    if (_eventBus) return _eventBus

    if (_cluster) {
      _eventBus = new EventBus()
      return _eventBus
    }

    // at this point, we know that cluster is not available (e.g. web environment)
    if (_cluster === false) {
      _eventBus = new EventBus()
      return _eventBus
    }

    try {
      _cluster = (await import('cluster')).default
    } catch (e) {
      _cluster = false
      debug('cluster module not present')
    }

    return new EventBus()
  }

  _promise = fn()

  return await _promise
}

export async function shutdown(callback?: ShutdownCb): Promise<void> {
  const eventBus = await getEventBus()

  return eventBus.shutdown(callback)
}

/**
 * This class is used to send events to registered log writers.
 *
 * Some log writers will emit `log4ts:pause` event
 *
 * @example
 * getEventBus().then((v) =>
 *  v.on('log4ts:pause', (evt) => {
 *    console.log(evt)
 *  })
 * )
 *
 */
class EventBus extends EventEmitter<'log4ts:pause'> {
  private logWriterListeners: EventListenerConfig<any[], any, any, any>[] = []

  private logWriters: Map<string, LogWriter<any, any>> = new Map()

  cluster: Cluster | false

  /**  indicates if message sending is disabled */
  enabled: boolean = true

  constructor() {
    super()

    // at this point, _cluster is populated with EventBus or false
    if (_cluster) {
      this.cluster = _cluster
      if (this.cluster) {
        this.cluster.off('message', this.receiver)
      }

      // if no cluster, do not configure listeners on cluster
      if (!this.cluster) {
        debug('Not listening for cluster messages, because clustering disabled.')
      } else if (this.cluster.isPrimary) {
        this.cluster.on('message', this.receiver)
      } else {
        debug('only primary cluster can subscribe to messages')
      }
    } else {
      this.cluster = false
    }
  }

  /**
   * returns true if this process is primary:
   * - if `cluster` is used and `cluster` is primary; OR
   * - clustering is not used (`process` is used instead)
   */
  isMaster() {
    return (this.cluster && this.cluster.isPrimary) || !this.cluster
  }

  private sendToListeners = (logEvent: LoggingEvent<any[], any>) => {
    if (!this.enabled) return

    const listeners = this.logWriterListeners.filter(
      (v) =>
        v.loggerName === logEvent.payload.loggerName &&
        logEvent.payload.level.isGreaterThanOrEqualTo(v.levelName)
    )

    listeners.forEach((conf) => conf.listener(logEvent))
  }

  // will be used in multiprocess environment with workers
  private receiver = (worker: Worker, message: string) => {
    debug('cluster message received from worker ', worker, ': ', message)
    // if (worker.topic && worker.data) {
    //   message = worker
    //   worker = undefined
    // }
    // if (message && message.topic === 'log4ts:message') {
    //   const logEvent = LoggingEvent.deserialize(message.data)
    //   this.sendToListeners(logEvent)
    // }
  }

  public send(msg: LoggingEvent<any[], any>) {
    if (this.isMaster()) {
      this.sendToListeners(msg)
    }
    // if workers are used in multiprocess environment
    else {
      // msg.payload.cluster = {
      //     workerId: cluster.worker.id,
      //     worker: process.pid,
      //   };
      process.send?.({ topic: 'log4ts:message', data: msg.serialize() })
    }
  }

  /** adds message listener */
  public addMessageListener(
    conf: EventListenerConfig<any[], any, any, any> & {
      logWriter: LogWriter<any, any>
    }
  ) {
    const { logWriter, levelName, listener, loggerName, logger } = conf
    this.logWriterListeners.push({ levelName, listener, loggerName, logger, logWriter })
    const registered = this.logWriters.get(conf.logWriter.name)
    if (registered && registered !== logWriter) {
      throw new Error('Duplicate logWriter name detected')
    }
    this.logWriters.set(conf.logWriter.name, logWriter)
  }

  public async shutdown(callback?: ShutdownCb) {
    debug('Shutdown called. Disabling all log writing.')

    this.enabled = false

    const logWritersToCheck = Array.from(this.logWriters.values())

    const logWriters = logWritersToCheck.length

    if (logWriters === 0) {
      debug('No log writers to shutdown')
      if (callback) callback()
    }

    let completed: number = 0
    let error: Error | undefined = undefined

    debug(`Found ${logWriters} log writers to shutdown`)

    async function complete(err?: Error) {
      error = error ?? err
      completed += 1
      debug(`LogWriter shutdowns complete: ${completed} / ${logWriters}`)
      if (completed >= logWriters) {
        debug('All shutdown functions completed.')
        if (callback) callback(error)
      }
    }

    logWritersToCheck.forEach((v) => v._shutdown(complete))
  }
}
