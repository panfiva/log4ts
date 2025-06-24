/*
export DEBUG=log4ts:RollingFileWriteStream
yarn run build && node ./dist/examples/test-fileStream.js
*/

import { RollingFileWriteStream } from '../rollingFileStream/RollingFileWriteStream'
import * as fs from 'fs-extra'

fs.appendFileSync('./logs/rolling-undef.txt', '00-123123123')

// the following files are out of sequence as file `rolling-1.txt.1` is missing
// they will be deleted on the very first roll, regardless of backup settings
fs.appendFileSync('./logs/rolling-undef.txt.2', '02-123123123')
fs.appendFileSync('./logs/rolling-undef.txt.3', '03-123123123')

const streamUndef = new RollingFileWriteStream('./logs/rolling-undef.txt', {
  maxSize: 5,
  backups: undefined,
})

streamUndef.write('1-12345', 'utf-8')
streamUndef.write('2-12345', 'utf-8')
streamUndef.write('3-12345', 'utf-8')
streamUndef.write('4-12345', 'utf-8')

const stream0 = new RollingFileWriteStream('./logs/rolling-0.txt', {
  maxSize: 5,
  backups: 0,
})
stream0.write('1-12345', 'utf-8')
stream0.write('2-12345', 'utf-8')
stream0.write('3-12345', 'utf-8')
stream0.write('4-12345', 'utf-8')

const stream1 = new RollingFileWriteStream('./logs/rolling-1.txt', {
  maxSize: 5,
  backups: 1,
})
stream1.write('1-12345', 'utf-8')
stream1.write('2-12345', 'utf-8')
stream1.write('3-12345', 'utf-8')
stream1.write('4-12345', 'utf-8')
