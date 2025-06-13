declare module 'date-format' {
  function format(pattern: string, date: Date): string
  function format(date: Date): string
  function asString(date: Date): string
  function asString(format: string, date: Date): string
  function parse(pattern: string, str: string, missingValuesDate: Date): Date
  export { format, asString, parse }
  export default format
}
