import type { ViewBackgroundMedia } from '@/core/config/types'

interface MediaResultMessage {
  type?: string
  requestId?: string
  value?: ViewBackgroundMedia
  error?: string
}

const embedded = typeof window !== 'undefined' && window.parent !== window
const pending = new Map<string, {
  resolve: (value: ViewBackgroundMedia | undefined) => void
  reject: (error: Error) => void
  timeout: number
}>()
let sequence = 0

function requestId(): string {
  sequence += 1
  return `media-${Date.now().toString(36)}-${sequence.toString(36)}`
}

window.addEventListener('message', (event: MessageEvent<MediaResultMessage>) => {
  if (!embedded || event.source !== window.parent || event.origin !== location.origin) return
  if (event.data?.type !== 'vue-panel:media-result' || !event.data.requestId) return

  const request = pending.get(event.data.requestId)
  if (!request) return
  pending.delete(event.data.requestId)
  window.clearTimeout(request.timeout)

  if (event.data.error) request.reject(new Error(event.data.error))
  else request.resolve(event.data.value)
})

function hostRequest(message: Record<string, unknown>): Promise<ViewBackgroundMedia | undefined> {
  if (!embedded) {
    return Promise.reject(new Error('Home Assistant media sources are only available inside the panel.'))
  }

  const id = requestId()
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      pending.delete(id)
      reject(new Error('Home Assistant did not return a media selection.'))
    }, 10 * 60_000)
    pending.set(id, { resolve, reject, timeout })
    window.parent.postMessage({ ...message, requestId: id }, location.origin)
  })
}

/** Open Home Assistant's native media-source browser, restricted to images. */
export function pickHostImage(current?: ViewBackgroundMedia): Promise<ViewBackgroundMedia | undefined> {
  // Vue refs expose objects as reactive proxies, which the browser's
  // structured-clone algorithm cannot transfer through postMessage.
  const serializableCurrent = current
    ? JSON.parse(JSON.stringify(current)) as ViewBackgroundMedia
    : undefined
  return hostRequest({ type: 'vue-panel:pick-media', current: serializableCurrent })
}

/** Upload through Home Assistant's native image media source. */
export function uploadHostImage(file: File): Promise<ViewBackgroundMedia | undefined> {
  return hostRequest({ type: 'vue-panel:upload-media', file })
}
