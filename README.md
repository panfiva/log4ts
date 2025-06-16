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

  Attach multiple loggers to the same log writer with different transform functions.
  This allows users to send send different data shapes in a type-safe manner

- **Graceful shutdown**

  Proper cleanup with `log4ts.shutdown(cb)` function. Once executed, all loggers will stop
  sending events to all registered log writers, and all log writers will receive shutdown
  request via `LogWriter.shutdownWriter(cb)` function call.

- **Built-in log writers**

  Rolling File and Splunk HEC

## Examples

All examples are configured with process signal listeners to demonstrate event handling

- [File Log Writer](./src/examples/file.ts)

  - Writing to a rolling log file
  - Define data type of log function parameters
  - Process cleanup when `SIGINT` signal received
  - Infer transform function parameters inside `<writer>.attachToLogger()`

- [Multi-File Log Writer](./src/examples/multiFile.ts)

  - Write to the same file using different loggers
  - Dynamically define which file will be used based on data attributes
  - Set and use logger context
  - Explicitly define transform function data type to infer its parameters

- [Splunk HEC Log Writer](./src/examples/splunkHec.ts)

  - Constrain log function args to specific data shape
  - Transform log function args to data shape supported by Splunk HEC logger

## Shutdown

Logging environment should execute `log4ts.shutdown(cb)` function before process exit.

Additionally, individual log writers could be shutdown manually by executing
`LogWriter.shutdownWriter(cb)`; this should be done to avoid memory leaks when
dynamically creating and registering log writers in custom code.

### Data loss during shutdown

`Logger.log(data)` will NOT send data:

- To all log writers after `log4ts.shutdown(cb)` is executed
- To the log writer that was terminated by `<logWriter>.shutdownWriter(cb)` command

However, backend calls to `LogWriter.write(data)` will still be forwarded to log writers!

**Warning!**

To avoid data loss and unhandled exceptions, inspect `LogWriter.isShuttingDown`
to determine if shutdown event was triggered before executing `LogWriter.write(data)`

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

  This function is executed when `LogWriter.shutdownWriter(cb)` is execute to terminate
  the environment.

  Note that users may also call `LogWriter.shutdownWriter(cb)` manually; however this will
  **NOT** stop new events to be send the log writer, resulting in exceptions or data loss.

  To avoid issues, implement validation `LogWriter.isShuttingDown !== true` before calling
  `this.write` method.

  - See usage example in multi file log writer

- Define `write = (data: LogWriterData): void = {...}` method

## Contributing

Contributions are welcome! Please feel free to submit a pull request
or open an issue for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.
