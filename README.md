# Log4ts TypeScript Project

This project is inspired by [log4js-node](https://log4js-node.github.io/log4js-node)

Key features and changes:

- Migrated from JavaScript to TypeScript
- Use classes to configure logger instead of configuration objects
- Attach multiple loggers to the same log writer
- Does not support custom log levels to simplify typing

## Examples

All examples are configured with process signal listeners to demonstrate event handling

- [File Log Writer](./src/examples/file.ts)

## Custom log writers

Custom log writers can be created by extending `LogWriter` class:

- Define `config` property with proper config data type.
- Define `shutdown = (cb?: ShutdownCb) => {...}` function
  - This function must execute `cb()` after shutdown routines complete
- Define `write = (data: LogWriterData): void = {...}` method

Call to `log4st.shutdown()` will trigger `LogWriter.shutdown(cb)` call for all
registered log writers. Log writer is registered when `LogWriter.attachToLogger()`
function is executed. Pending writes might be lost unless proper handling logic is
added to log writer `write` and `shutdown` methods to track pending writes
and wait for completion before proceeding with `shutdown` call

## Contributing

Contributions are welcome! Please feel free to submit a pull request
or open an issue for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.
