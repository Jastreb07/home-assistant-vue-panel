import { getConnection } from './connection'
import type {
  PortableCardCatalogEntry,
  PortableCardDocument,
} from '@/core/registry/portableCardTypes'
import { readonly, ref } from 'vue'

const catalogRevision = ref(0)
const documentCache = new Map<string, Promise<PortableCardDocument>>()

interface CardIdentity {
  manufacturer: string
  cardName: string
}

function connection() {
  const active = getConnection()
  if (!active) throw new Error('No Home Assistant connection is available.')
  return active
}

function identity(type: string): CardIdentity {
  const [manufacturer, cardName, ...extra] = type.split('/')
  if (!manufacturer || !cardName || extra.length) throw new Error('Invalid portable card identity.')
  return { manufacturer, cardName }
}

export function isCardRevisionConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error
    && (error as { code?: string }).code === 'revision_conflict'
}

export function invalidatePortableCardCatalog(): void {
  documentCache.clear()
  catalogRevision.value += 1
}

export function usePortableCardCatalogRevision() {
  return readonly(catalogRevision)
}

export async function listPortableCards(): Promise<PortableCardCatalogEntry[]> {
  return connection().sendMessagePromise<PortableCardCatalogEntry[]>({
    type: 'vue_panel/cards/list',
  })
}

export async function getPortableCard(type: string): Promise<PortableCardDocument> {
  const card = identity(type)
  let pending = documentCache.get(type)
  if (!pending) {
    pending = connection().sendMessagePromise<PortableCardDocument>({
      type: 'vue_panel/cards/get',
      manufacturer: card.manufacturer,
      card_name: card.cardName,
    })
    documentCache.set(type, pending)
    pending.catch(() => documentCache.delete(type))
  }
  return pending
}

export async function createPortableCard(document: string): Promise<PortableCardDocument> {
  return connection().sendMessagePromise<PortableCardDocument>({
    type: 'vue_panel/cards/create',
    document,
  })
}

export async function importPortableCard(document: string): Promise<PortableCardDocument> {
  return connection().sendMessagePromise<PortableCardDocument>({
    type: 'vue_panel/cards/import',
    document,
  })
}

export async function updatePortableCard(
  type: string,
  document: string,
  expectedHash: string,
): Promise<PortableCardDocument> {
  const card = identity(type)
  return connection().sendMessagePromise<PortableCardDocument>({
    type: 'vue_panel/cards/update',
    manufacturer: card.manufacturer,
    card_name: card.cardName,
    expected_hash: expectedHash,
    document,
  })
}

export async function deletePortableCard(type: string, expectedHash: string): Promise<void> {
  const card = identity(type)
  await connection().sendMessagePromise({
    type: 'vue_panel/cards/delete',
    manufacturer: card.manufacturer,
    card_name: card.cardName,
    expected_hash: expectedHash,
  })
}

export async function duplicatePortableCard(
  sourceType: string,
  manufacturer: string,
  cardName: string,
  name: string,
): Promise<PortableCardDocument> {
  const source = identity(sourceType)
  return connection().sendMessagePromise<PortableCardDocument>({
    type: 'vue_panel/cards/duplicate',
    source_manufacturer: source.manufacturer,
    source_card_name: source.cardName,
    manufacturer,
    card_name: cardName,
    name,
  })
}
