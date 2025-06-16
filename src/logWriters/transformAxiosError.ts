import { AxiosError, isAxiosError } from 'axios'

export type AxiosErrorExport = {
  status: number
  name: string // 'AxiosError'
  nameOrig: string
  request: {
    baseUrl?: string
    url?: string
    method?: string
    timeout?: number
    params?: Record<string, any>
  }
  response?: {
    headers?: Record<string, any>
    data?: Record<string, any> | null
  }

  message: string
  messageOrig: string
  /** returned on name resolution and network errors */
  syscall?: string
  /** returned on name resolution and network errors */
  errno?: number
  /** returned on name resolution errors */
  code?: string
  /** returned on name resolution errors */
  hostname?: string
  /** returned on network errors */
  address?: string
  /** returned on network errors */
  port?: number
  // provided on invalid url config
  input?: string
  stack?: string
}

import pickBy from 'lodash/pickBy'
import isPlainObject from 'lodash/isPlainObject'
import isEmpty from 'lodash/isEmpty'

export function removeUndefined<T extends Record<string, any>>(o: T): T {
  return pickBy(o, (v) => v !== undefined) as T
}

export function removeEmptyObject<T extends Record<string, any>>(o: T): T {
  return pickBy(o, (v) => !(isPlainObject(v) && isEmpty(v))) as T
}

export function transformAxiosError(e: AxiosError): Error {
  if (!isAxiosError(e)) return e

  const { url, method, baseURL: baseUrl, timeout, params } = e.config! || {}
  const config = { url, method, baseUrl, timeout, params }

  const { name: nameOrig, code, message, status = e.response?.status ?? 500 } = e
  const e1 = { nameOrig, code }
  const { address, errno, syscall, port, hostname, input, stack } = e as any
  const e2 = { address, errno, syscall, port, hostname, input, stack }

  const headers =
    typeof e.response?.headers?.toJSON === 'function' ? e.response.headers.toJSON() : undefined

  let ret: AxiosErrorExport = {} as any

  const e3 = {
    name: 'AxiosError',
    messageOrig: message,
    ...e1,
    ...e2,

    request: config,
    response: { headers },
  }

  if (e.response === undefined) {
    if (e.code === 'ERR_CANCELED') {
      ret = {
        message: 'axios.cancelled',
        status: 500,
        ...e3,
      }
    } else if (e.code === 'ECONNABORTED') {
      ret = {
        message: 'axios.aborted',
        status: 500,
        ...e3,
      }
    } else if (e.request) {
      ret = {
        message: 'axios.network_error',
        status: 500,
        ...e3,
      }
    } else {
      ret = {
        message: 'axios.request_setup_failed',
        status: 500,
        ...e3,
      }
    }
  } else {
    const data = e.response.data

    if (e.message === 'Network Error' || e.code === 'ERR_NETWORK') {
      ret = {
        message: 'axios.network_error',
        status: 500,
        ...e3,
      }
    } else if (e.code === 'ERR_BAD_RESPONSE' && status === 502) {
      ret = {
        message: 'axios.bad_gateway',
        status: 500,
        ...e3,
      }
    } else if (typeof data === 'string' && !data.startsWith('<html>')) {
      ret = {
        message: data,
        status,
        ...e3,
      }
    } else if (typeof data === 'string') {
      ret = {
        message: '<html>...</html>',
        status,
        ...e3,
      }
    } else if (data === undefined) {
      ret = {
        message: 'axios.failed_undefined_data',
        status,
        ...e3,
      }
    } else if (data) {
      ret = {
        message: 'axios.failed',
        status,
        ...e3,
        response: { headers, data: { 'e.response.data': data } },
      }
    } else if (e.request) {
      // The request was made but no response was received (null response)
      // `error.request` is an instance of XMLHttpRequest (browser) or http.ClientRequest (node.js)
      ret = { message: 'axios.network_error', status: 500, ...e3, response: { headers, data } }
    } else {
      // Something happened in setting up the request that triggered an Error
      ret = {
        message: 'axios.request_setup_failed',
        status: 500,
        ...e3,
        response: { headers, data },
      }
    }
  }

  ret = removeUndefined(ret)

  if (ret.request?.params) ret.request.params = removeUndefined(ret.request.params)

  if (ret.request) ret.request = removeUndefined(ret.request)
  if (ret.request) ret.request = removeEmptyObject(ret.request)

  if (ret.response?.headers) ret.response.headers = removeUndefined(ret.response.headers)
  if (ret.response?.data) ret.response.data = removeUndefined(ret.response.data)

  if (ret.response) ret.response = removeUndefined(ret.response)
  if (ret.response) ret.response = removeEmptyObject(ret.response)

  ret = removeUndefined(ret)
  ret = removeEmptyObject(ret)

  const err = new Error(ret.message)
  Object.assign(err, ret)

  return err
}
