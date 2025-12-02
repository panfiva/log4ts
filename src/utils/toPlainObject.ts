import isArray from 'lodash/isArray'
import isEmpty from 'lodash/isEmpty'
import isPlainObject from 'lodash/isPlainObject'

const nonEnumerablePropsToCopy = ['code', 'errno', 'syscall', 'status']

type PlainObject = Record<string, any>

type ErrorAttributes<T extends PlainObject> = {
  [K in keyof T]: T[K]
} & Record<string, any>

type ToPlainObjectReturn<T> = T extends readonly any[]
  ? any[]
  : // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    T extends Function
    ? string
    : T extends symbol
      ? string
      : T extends Date
        ? Date
        : T extends object
          ? ErrorAttributes<T>
          : T

type RecordOrArray = PlainObject | Array<any>

const CIRCULAR = '<circular ref>'

/** exports Error to plain object; removes undefined, functions and also circular dependencies */
export function toPlainObject<T, R = ToPlainObjectReturn<T>>(
  data: T,
  options?: {
    /** if set, `stack` property is removed */
    noStack?: boolean

    removeEmpty?: boolean
    /**
     * custom transformation function that can be applied to all objects and class instances
     * - if returns `return.isSanitized=true`, then `return.value` is used
     * - if return is `return.isSanitized=false`, then object follows the standard rules
     */
    transform?: (value: any) => { isSanitized: true; value: any } | { isSanitized: false }
    /**
     * if set, circular deps are computed for entire object
     * other wise, circular deps are computed within the path
     */
    globalCircular?: boolean
  }
): R {
  const { noStack, transform, globalCircular, removeEmpty } = options || {}

  if (
    data === null ||
    data === undefined ||
    typeof data === 'boolean' ||
    typeof data === 'bigint' ||
    typeof data === 'number' ||
    typeof data === 'string'
  )
    return data as any

  if (typeof data === 'function') return `<function> ${data.name || 'anonymous'}` as any

  if (typeof data === 'symbol') return `<symbol> ${data.description || 'anonymous'}` as any

  if (data instanceof Date) {
    return data as any
  }

  const refs = new Map()

  const sanitizer = new Sanitize({
    data,
    xref: data,
    current_path: '',
    refs,
    noStack,
    transform,
    globalCircular,
    removeEmpty,
  })

  const ret = sanitizer.sanitized
  return ret as any
}

type SanitizeProps = {
  /** actual object being processed */
  xref: RecordOrArray
  /** object that is being worked on */
  data: RecordOrArray
  /** object that is being worked on */
  dataTransformed?: RecordOrArray
  current_path: string
  refs?: Map<object, string>
  noStack?: boolean
  removeEmpty?: boolean
  /**
   * custom transformation function that can be applied to all objects and class instances
   * - if returns `return.isSanitized=true`, then `return.value` is used
   * - if return is `return.isSanitized=false`, then object follows the standard rules
   */
  transform?: (value: any) => { isSanitized: true; value: any } | { isSanitized: false }
  /**
   * if set, circular deps are computed for entire object
   * other wise, circular deps are computed within the path
   */
  globalCircular?: boolean
}

class Sanitize {
  /** actual object being processed */
  private xref: RecordOrArray
  /** object that is being worked on */
  private data: RecordOrArray

  /** map <data:object, owner_path:string> */
  private refs: Map<object, string>
  private current_path: string
  private noStack: boolean
  private removeEmpty: boolean
  /**
   * custom transformation function that can be applied to all objects and class instances
   * - if returns `return.isSanitized=true`, then `return.value` is used
   * - if return is `return.isSanitized=false`, then object follows the standard rules
   */
  private transform: (value: any) => { isSanitized: true; value: any } | { isSanitized: false }
  /**
   * if set, circular deps are computed for entire object
   * other wise, circular deps are computed within the path
   */
  private globalCircular?: boolean

  /** data without circular deps */
  sanitized: RecordOrArray | string

  constructor(props: SanitizeProps) {
    this.xref = props.xref
    this.data = props.data
    this.refs = props.refs ?? new Map()
    this.noStack = props.noStack ?? false
    this.transform = props.transform ?? (() => ({ isSanitized: false }))
    this.globalCircular = props.globalCircular ?? false
    this.removeEmpty = props.removeEmpty ?? false

    this.current_path = props.current_path

    let isRefOwner: boolean = false

    const current_path = this.current_path
    const noStack = this.noStack

    if (!this.refs.has(this.xref)) {
      this.refs.set(this.xref, current_path === '' ? '.' : current_path)
      isRefOwner = true
    }

    const ref_owner = this.refs.get(this.xref)!

    if (!isRefOwner) {
      this.sanitized = `${CIRCULAR} ${ref_owner}`
    } else if (isArray(this.data)) {
      this.sanitized = this._removeCircularRef(this.data, isRefOwner)
    } else {
      const transformed = this.transform(this.data)
      // custom transform for objects
      if (transformed.isSanitized) {
        this.sanitized = transformed.value
      } else {
        const o = this.get_object_props(this.data)
        if (noStack && o) delete o.stack
        this.sanitized = this._removeCircularRef(o, isRefOwner)
      }
    }

    /**
     * If the following code is enabled, the same object will show up as a separate object inside peer attribute;
     * otherwise, a reference inside a peer attribute will be tagged as circular reference
     */
    if (isRefOwner && !this.globalCircular) {
      this.refs.delete(this.xref)
    }

    if (typeof this.sanitized === 'object' && noStack && !Array.isArray(this.sanitized))
      delete this.sanitized.stack
  }

  /** returns value with remove circular deps.  */
  private _removeCircularRef = (o: RecordOrArray, isRefOwner: boolean): any => {
    const { current_path, refs, noStack, transform, globalCircular, removeEmpty } = this

    if (o instanceof Date) {
      return this.data
    }
    // objects
    else if (o && typeof o === 'object') {
      const isAr: boolean = Array.isArray(o)

      const ret: RecordOrArray = isAr ? [] : {}

      for (const key in o) {
        type K = keyof typeof o
        const val = o[key as K]

        const add = (val: any) => {
          if (isAr) ret.push(val)
          else {
            if (val === undefined) return
            if (
              this.removeEmpty &&
              val &&
              isPlainObject(val) &&
              !(val instanceof Date) &&
              isEmpty(val)
            )
              return
            ret[key as K] = val
          }
        }

        const new_path = `${current_path}.${key}`

        // remove circular deps
        if (refs.has(val)) {
          let ref_owner = this.refs.get(val)!
          if (ref_owner === '') ref_owner = '.'
          add(`${CIRCULAR} ${ref_owner}`)
        }
        // function - do not include
        else if (typeof val === 'function') add(`<function> ${val.name || 'anonymous'}`)
        // symbol  - do not include
        else if (typeof val === 'symbol') add(`<symbol> ${val.description || 'anonymous'}`)
        // undefined
        else if (val === undefined) add(undefined)
        else if (val === null) add(null)
        // convert Error to object
        else if (val instanceof Error) {
          // custom transform for Errors
          const transformed = this.transform(val)
          if (transformed.isSanitized) {
            add(transformed.value)
            continue
          }

          const exported = this.getErrorProps(val)

          const sanitizer = new Sanitize({
            data: exported,
            xref: val,
            current_path: new_path,
            noStack,
            refs,
            transform,
            globalCircular,
            removeEmpty,
          })

          const v = sanitizer.sanitized

          add(v)
        }
        // primitive types
        else if (
          typeof val === 'string' ||
          typeof val === 'boolean' ||
          typeof val === 'number' ||
          typeof val === 'bigint' ||
          val instanceof Date
        ) {
          add(val)
        }

        // Plain object or Array
        else {
          // custom transform for plain objects
          if (!Array.isArray(val) && typeof val === 'object') {
            const transformed = this.transform(val)
            if (transformed.isSanitized) {
              add(transformed.value)
              continue
            }
          }

          const sanitizer = new Sanitize({
            data: val,
            xref: val,
            current_path: new_path,
            noStack,
            removeEmpty,
            refs,
            transform,
            globalCircular,
          })

          const v = sanitizer.sanitized

          add(v)
        }
        continue
      }

      if (isRefOwner && !this.globalCircular) {
        refs.delete(this.xref)
      }

      return ret
    }
    // primitive types (non-objects)
    else {
      return this.data
    }
  }

  /**
   * converts object with non-iterable properties to plain object
   * removes empty values
   *
   */
  private get_object_props = (o: PlainObject): PlainObject => {
    const ret: PlainObject = {}
    Object.getOwnPropertyNames(o).forEach((key) => {
      const v = o[key]

      if (typeof v === 'function') return
      if (typeof v === 'symbol') return
      if (v === undefined) return
      if (this.removeEmpty && isPlainObject(v) && isEmpty(v)) return
      // if (Array.isArray(v) && v.length === 0) return

      ret[key] = v
    })
    return ret
  }

  private getErrorProps(obj: Error) {
    const ret: Record<string, any> = {}
    let current = obj as any
    do {
      Object.getOwnPropertyNames(current).forEach((key) => {
        // Only add if not already added (to prioritize own properties)
        if (ret[key] === undefined) {
          const v = current && current[key] !== undefined ? current[key] : undefined

          if (typeof v === 'function') return
          if (typeof v === 'symbol') return
          if (v === undefined) return
          if (this.removeEmpty && isPlainObject(v) && isEmpty(v)) return
          // if (Array.isArray(v) && v.length === 0) return

          ret[key] = v
        }
      })
      current = Object.getPrototypeOf(current)
    } while (current) // Stop when prototype is null (Object.prototype's prototype)

    nonEnumerablePropsToCopy.forEach((key) => {
      if (key in obj) ret[key] = obj[key as keyof typeof obj]
    })

    return ret
  }
}
