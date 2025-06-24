/*
export DEBUG=log4ts:RollingFileWriteSyncStream
yarn run build && node ./dist/examples/test-syncFileStream.js
*/

import { RollingFileWriteSyncStream } from '../rollingFileStream/RollingFileWriteSyncStream'
import * as fs from 'fs-extra'
import * as os from 'os'

const eol = os.EOL

fs.appendFileSync('./logs/rolling-1.txt', '01-123123123')

// the following files are out of sequence as file `rolling-1.txt.1` is missing
// they will be deleted on the very first roll, regardless of backup settings
fs.appendFileSync('./logs/rolling-1.txt.2', '02-123123123')
fs.appendFileSync('./logs/rolling-1.txt.3', '03-123123123')

const stream1 = new RollingFileWriteSyncStream('./logs/rolling-1.txt', {
  maxSize: 5,
  backups: 1,
})
stream1.write('1-12345' + eol, 'utf-8')
stream1.write('2-12345' + eol, 'utf-8')
stream1.write('3-12345' + eol, 'utf-8')
stream1.write('4-12345' + eol, 'utf-8')

const stream0 = new RollingFileWriteSyncStream('./logs/rolling-0.txt', {
  maxSize: 5,
  backups: 0,
})
stream0.write('1-12345' + eol, 'utf-8')
stream0.write('2-12345' + eol, 'utf-8')
stream0.write('3-12345' + eol, 'utf-8')
stream0.write('4-12345' + eol, 'utf-8')

const streamUndef = new RollingFileWriteSyncStream('./logs/rolling-undef.txt', {
  maxSize: 5,
  backups: undefined,
})
streamUndef.write('1-12345' + eol, 'utf-8')
streamUndef.write('2-12345' + eol, 'utf-8')
streamUndef.write('3-12345' + eol, 'utf-8')
streamUndef.write('4-12345' + eol, 'utf-8')

const streamDt = new RollingFileWriteSyncStream('./logs/rolling-dt.txt', {
  backups: 1,
  // pattern: 'yyyyMMdd',
  pattern: true,
})
streamDt.write('1-12345' + eol, 'utf-8')
streamDt.write('2-12345' + eol, 'utf-8')
streamDt.write('3-12345' + eol, 'utf-8')
streamDt.write('4-12345' + eol, 'utf-8')
