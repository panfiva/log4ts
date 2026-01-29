/**
 * Utility function: if T extends never, returns Record<string, never>; otherwise returns T
 */
export function requiredObject<T>(val: any): [T] extends [never] ? Record<string, never> : T {
  return (val ?? ({} as any)) as [T] extends [never] ? Record<string, never> : T
}
