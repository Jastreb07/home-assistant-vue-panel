let fallbackCounter = 0

export function runtimeId(prefix: string): string {
  const cryptoApi = globalThis.crypto
  if (typeof cryptoApi?.getRandomValues === 'function') {
    const values = new Uint32Array(2)
    cryptoApi.getRandomValues(values)
    return `${prefix}-${values[0]!.toString(36)}${values[1]!.toString(36)}`
  }

  return `${prefix}-${Date.now().toString(36)}-${(fallbackCounter++).toString(36)}`
}
