import type { CallStack } from './types'

const stackReg = /^(?:\s*)at (?:(.+) \()?(?:([^(]+?):(\d+):(\d+))\)?$/

export type ParseCallStackFunction = (data: Error, skipIdx?: number) => CallStack | undefined

/**
 * Extracts callstack from error - returns an entry that generated the error
 */
export const defaultParseCallStack: ParseCallStackFunction = (
  data: Error,
  // The _log function is 3 levels deep, we need to skip those to make it to the callSite
  // Plus top entry is Error
  skipIdx = 4
): CallStack | undefined => {
  try {
    if (!data.stack) return

    const stackLines = data.stack.split('\n').slice(skipIdx)
    if (!stackLines.length) {
      // There's no stack in this stack
      // Should we try a previous index if skipIdx was set?
      return
    }
    const lineMatch = stackReg.exec(stackLines[0])
    /* istanbul ignore else: failsafe */
    if (lineMatch && lineMatch.length === 5) {
      // extract class, function and alias names
      let className = ''
      let functionName = ''
      let functionAlias = ''
      if (lineMatch[1] && lineMatch[1] !== '') {
        // WARN: this will unset alias if alias is not present.
        ;[functionName, functionAlias] = lineMatch[1].replace(/[[\]]/g, '').split(' as ')
        functionAlias = functionAlias || ''

        if (functionName.includes('.')) [className, functionName] = functionName.split('.')
      }

      return {
        fileName: lineMatch[2],
        lineNumber: parseInt(lineMatch[3], 10),
        columnNumber: parseInt(lineMatch[4], 10),
        callStack: stackLines.join('\n'),
        className,
        functionName,
        functionAlias,
        callerName: lineMatch[1] || '',
      }
    } else {
      // will never get here unless nodejs has changes to Error
      console.error('log4ts.logger - defaultParseCallStack error')
    }
  } catch (err) {
    // will never get error unless nodejs has breaking changes to Error
    console.error('log4ts.logger - defaultParseCallStack error', err)
  }
  return
}
