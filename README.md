# @panfiva/log4ts

A NodeJs logging library written in TypeScript.

Inspired by [log4js-node](https://log4js-node.github.io/log4js-node).

## Installation

```bash
npm install @panfiva/log4ts
# or
yarn add @panfiva/log4ts
```

## Key Features

- **TypeScript-first**

  Built from the ground up with TypeScript

- **Customization**

  Create custom log writer classes and use them through the project

- **Shared log writers**

  Attach multiple loggers to the same log writer by customizing `Logger.transform()`.
  This allows users to send send different data shapes in a type-safe manner

- **Graceful shutdown**

  Proper cleanup with `log4ts.shutdown(cb)` function. Once executed, all loggers will stop
  sending events to all registered log writers, and all log writers will receive shutdown
  request via `LogWriter.shutdownWriter(cb)` function call.

- **Built-in log writers**

  Rolling File and Splunk HEC

## Basic Example

```ts
const logger = new Logger({ loggerName: 'L', level: 'INFO', context: { label: 'test' } })
const writer1 = new ConsoleLogWriter('W1')
const writer2 = new ConsoleLogWriter('W2')

writer1.register(logger, 'INFO', (event, writerName, writerConfig) => {
  const { data, startTime, context, level } = event
  return [{ data, startTime, context, level, writerName, writerConfig }]
})

writer2.register(logger, 'WARN', (event, writerName, writerConfig) => {
  const { data, startTime, context, level } = event
  return [{ data, startTime, context, level, writerName, writerConfig }]
})

logger.debug('debug-test') // will not send due to logger level
logger.info('debug-info') // will send events only to W2
logger.error('debug-warn') // will send events to W1 and W2
```

## Examples

All examples are configured with process signal listeners to demonstrate event handling

- [File Log Writer](./src/examples/file.ts)
  - Writing to a rolling log file
  - Define data type of log function parameters
  - Process cleanup when `SIGINT` signal received
  - Infer layout function parameters inside `<writer>.register()`

- [Multi-File Log Writer](./src/examples/multiFile.ts)
  - Write to the same file using different loggers
  - Dynamically define which file will be used based on data attributes
  - Set and use logger context
  - Explicitly define layout function data type to infer its parameters

- [Splunk HEC Log Writer](./src/examples/splunkHec.ts)
  - Constrain log function args to specific data shape
  - Transform log function args to data shape supported by Splunk HEC logger

- [Custom Context](src/examples/customContext.ts)
  - Create a second instance of a logger with different context

- [Custom Logger Output](src/examples/customLoggerOutput.ts)
  - Create 2 classes that accept different data format to be
    forwarded to a shared event writer

- [Sync File Log Writer](./src/examples/fileSync.ts)
  - Writing to a rolling file synchronously

- [Console Log Writer with Color](./src/examples/consoleLogger.ts)
  - Writing to console log with color

## Shutdown

Logging environment should execute `log4ts.shutdown(cb)` function before process exit.

Additionally, individual log writers could be shutdown manually by executing
`LogWriter.shutdownWriter(cb)`; this should be done to avoid memory leaks when
dynamically creating and registering log writers in custom code.

### Data loss during shutdown

`Logger.log(data)` will NOT send data:

- To all log writers after `log4ts.shutdown(cb)` is executed
- To the log writer that was terminated by `<logWriter>.shutdownWriter(cb)` command

However, direct calls to `LogWriter.write(data)` WILL be forwarded to log writers!

**Warning!**

To avoid data loss and unhandled exceptions, inspect `LogWriter.isShuttingDown`.
to determine if shutdown event was triggered before calling `LogWriter.write(data)`.

## Custom log writers

Custom log writers can be created by extending `LogWriter` class:

- Extend `LogWriter` class with appropriate data types

  `FormattedData` - data that will be received by `LogWriter.write(data)` method

  `Config` - configuration parameters for log writer

  ```ts
  class CustomWriter extends LogWriter<FormattedData, Config> {}
  ```

- Override protected `_shutdown` function, if needed

  The shutdown function must execute `cb` before exit.

  ```ts
  // default function
  protected _shutdown: ShutdownFn = (cb) => {
    if (cb) cb()
  }
  ```

- Define protected `_write` function

  ```ts
  // default function definition
  type WriteMethod<D> = ((data: D) => Promise<void>) | ((data: D) => void)
  protected abstract _write: WriteMethod<TFormattedData>
  ```

  The `_write` function will be called when `LogWriter.write(data)`
  is called directly, or via `Logger.log(data)` calls

## Custom loggers

Custom loggers can be used to reformat logger payload before sending data
to log writers.

```ts
class Logger2 extends Logger<TData, TContext, TDataOut> {
  // must return same data type as returned by the main class
  transform = (...data: TData): { data: TDataOut; event?: Error } => {
    return ['updated', ...data]
  }
}
```

See [Customize logger payload](./README.md#customize-logger-payload)

## Logger context update

Most of the time, loggers are defined and registered only once in the application.
When logger is used, its context is set globally. Any changes to logger context will
impact all other logger log requests.

There are situations, however, when loggers need to be created with a context that is
unique to a specific transaction. This can be accomplished as follows:

- Create a global logger and register it to appropriate log writers
- Create a second logger with the same name, but different context

**Warning!** Do not register the new logger with any log writers

See [Custom Context](src/examples/customContext.ts) example for details.

## Customize logger payload

When multiple instances of a logger expect to receive different data formats,
registered layout function must be to handle different data shapes. This approach
has the following issues:

- may increase complexity of registered layout function
- may require changing logger log function args to differentiate input - impacts usability

A better approach is to create a new logger class that uses `Logger.format()` to reformat
user input before data is sent to the registered layout function.

See [Custom Logger Output](src/examples/customLoggerOutput.ts)

## Contributing

Contributions are welcome! Please feel free to submit a pull request
or open an issue for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.
