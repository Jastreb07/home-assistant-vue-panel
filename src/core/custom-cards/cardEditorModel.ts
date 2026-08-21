import type { CustomCardDefinition, CustomCardVariable } from '@/core/config/types'
import type { PortableCardDocument } from '@/core/registry/portableCardTypes'
import { newId } from '@/core/config/dashboardStore'

export function editorDefinitionFromDocument(
  document: PortableCardDocument,
): CustomCardDefinition {
  return {
    id: document.type,
    format: document.format,
    formatVersion: document.formatVersion,
    apiVersion: document.apiVersion,
    manufacturer: document.manufacturer,
    cardName: document.cardName,
    name: document.name,
    description: document.description,
    icon: document.icon,
    group: document.group,
    translations: {
      fallback: document.translations?.fallback ?? 'en',
      languages: Object.fromEntries(
        Object.entries(document.translations?.languages ?? { en: {} })
          .map(([language, catalog]) => [language, { ...catalog }]),
      ),
    },
    areas: [...document.areas],
    capabilities: [...document.capabilities],
    detail: document.detail ? { ...document.detail } : undefined,
    html: document.html,
    css: document.css,
    javascript: document.javascript,
    variables: document.variables.map((variable) => ({
      ...variable,
      options: variable.options ? [...variable.options] : undefined,
      optionLabels: variable.optionLabels ? { ...variable.optionLabels } : undefined,
      id: newId('variable'),
    } satisfies CustomCardVariable)),
    defaultSize: { ...document.defaultSize },
    defaultResponsive: { ...document.defaultResponsive },
    fullRow: document.fullRow,
    contentHash: document.contentHash,
    writable: document.writable,
    source: document.source,
  }
}
