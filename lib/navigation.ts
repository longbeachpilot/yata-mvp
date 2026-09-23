// Preserve booking query strings but never redirect to another origin.
export function safeNext(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') ||
      /[\\\u0000-\u0020\u007f]/.test(value)) return null
  try {
    const url = new URL(value, 'https://yata.invalid')
    if (url.origin !== 'https://yata.invalid') return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch { return null }
}
