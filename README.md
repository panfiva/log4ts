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

  Proper cleanup with `shutdown()` function

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

## Custom log writers

Custom log writers can be created by extending `LogWriter` class:

- Define `config` property with proper config data type.
- Define `shutdown = (cb?: ShutdownCb) => {...}` function
  - This function must execute `cb()` after shutdown routines complete
- Define `write = (data: LogWriterData): void = {...}` method

Call to `log4st.shutdown()` will trigger `LogWriter.shutdown(cb)` call for all
registered log writers.

Log writer is registered when `LogWriter.attachToLogger()` function is executed.

Pending writes might be lost unless proper handling logic is
added to log writer `write` and `shutdown` methods to track pending writes
and wait for completion before proceeding with `shutdown` call

## Contributing

Contributions are welcome! Please feel free to submit a pull request
or open an issue for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.
