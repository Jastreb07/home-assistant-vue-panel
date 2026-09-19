import { getConnection } from './connection'
import type { ThemeCatalogEntry, ThemeDocument } from '@/core/theme/themeTypes'

function connection() {
  const active = getConnection()
  if (!active) throw new Error('No Home Assistant connection is available.')
  return active
}

export async function listThemes(): Promise<ThemeCatalogEntry[]> {
  return connection().sendMessagePromise<ThemeCatalogEntry[]>({
    type: 'vue_panel/themes/list',
  })
}

export async function getTheme(name: string): Promise<ThemeDocument> {
  return connection().sendMessagePromise<ThemeDocument>({
    type: 'vue_panel/themes/get',
    theme: name,
  })
}
