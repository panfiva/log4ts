// see https://github.com/chalk/ansi-regex/blob/main/index.js
export function ansiRegex({ onlyFirst = false } = {}) {
  //
  const ST = '(?:\\u0007|\\u001B\\u005C|\\u009C)'
  const pattern = [
    `[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?${ST})`,
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))',
  ].join('|')

  return new RegExp(pattern, onlyFirst ? undefined : 'g')
}

export function stripAnsi(val: any) {
  if (typeof val !== 'string') {
    return val
  }
  return val.replace(ansiRegex(), '')
}
