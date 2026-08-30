import { getConnection } from '@/core/ha/connection'

interface ResolvedMediaSource {
  url: string
  mime_type: string
}

const resolved = new Map<string, Promise<string>>()

/** Resolve a stable HA media-source id to its signed browser URL. */
export function resolveMediaSourceUrl(source: string): Promise<string> {
  if (!source.startsWith('media-source://')) return Promise.resolve(source)

  const cached = resolved.get(source)
  if (cached) return cached

  const connection = getConnection()
  if (!connection) return Promise.reject(new Error('No Home Assistant connection is available.'))

  const request = connection.sendMessagePromise<ResolvedMediaSource>({
    type: 'media_source/resolve_media',
    media_content_id: source,
  }).then((result) => result.url).catch((error) => {
    resolved.delete(source)
    throw error
  })
  resolved.set(source, request)
  return request
}
