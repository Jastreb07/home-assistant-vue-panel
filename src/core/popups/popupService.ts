import { readonly, ref } from 'vue'
import type {
  CardDetailConfig,
  DialogContentPosition,
  DialogMobileHeight,
} from '@/core/config/types'
import { cardRegistry } from '@/core/registry/cardRegistry'
import { pickVariables, type PopupContext } from './popupContext'

/**
 * Dialogs the panel currently shows. Both kinds are stacked: a custom popup
 * defined in the dashboard and the detail view of one entity.
 */
export interface PopupRequest {
  key: string
  /** Custom popup defined in the dashboard */
  popupId?: string
  /** Detail view: the dialog card rendered for one entity */
  cardType?: string
  /** Entity the detail view belongs to — drives the built-in fallback */
  entityId?: string
  /** Vertical body position — detail cards default to center */
  contentPosition?: DialogContentPosition
  /** Mobile dialog height — detail cards default to fit-content */
  mobileHeight?: DialogMobileHeight
  context: PopupContext
  /** Runs when this dialog is closed — used to return to the popup manager. */
  onClose?: () => void
}

const stack = ref<PopupRequest[]>([])
let sequence = 0

export function usePopupStack() {
  return readonly(stack)
}

/** Detail cards follow one naming rule, so a domain default needs no config. */
export function domainDetailCard(entityId: string): string {
  const domain = String(entityId).split('.')[0] ?? ''
  const type = `vue-panel/${domain}-detail`
  return domain && cardRegistry[type] ? type : ''
}

export interface DetailOptions {
  /** Overrides the card's own detail card and the domain default */
  card?: string
  entityId?: string
  variables?: string[]
  /** Additional per-opening values for interactive detail cards. */
  context?: PopupContext
  position?: DialogContentPosition
  mobileHeight?: DialogMobileHeight
}

/**
 * Open the detail view of a card: the explicitly requested dialog card, the
 * card's own `detail.card`, or the default card of the entity's domain.
 */
export function openDetail(
  config: Record<string, unknown>,
  detail: CardDetailConfig | undefined,
  options: DetailOptions = {},
): void {
  const entityKey = detail?.entityKey ?? 'entity'
  const entityId = String(options.entityId ?? config[entityKey] ?? '')
  const cardType = options.card || detail?.card || domainDetailCard(entityId)
  if (cardType && !cardRegistry[cardType]) {
    console.warn(`[vue-panel] Unknown detail card ${cardType}`)
  }
  stack.value = [...stack.value, {
    key: `detail-${++sequence}`,
    cardType: cardType && cardRegistry[cardType] ? cardType : '',
    entityId,
    contentPosition: options.position ?? detail?.position ?? 'center',
    mobileHeight: options.mobileHeight ?? detail?.mobileHeight ?? 'fit-content',
    context: {
      ...pickVariables(config, options.variables ?? detail?.variables),
      ...options.context,
      // The detail card always needs the entity it was opened for, even when
      // the card restricts which of its values are handed over.
      ...(entityId ? { [entityKey]: entityId, entity: entityId } : {}),
    },
  }]
}

/** Open a custom popup by id, handing the caller's values to its cards. */
export function openPopup(
  popupId: string,
  context: PopupContext = {},
  options: { onClose?: () => void } = {},
): void {
  stack.value = [...stack.value, {
    key: `popup-${++sequence}`,
    popupId: String(popupId),
    context: { ...context },
    onClose: options.onClose,
  }]
}

export function closePopup(key: string): void {
  const closed = stack.value.find((entry) => entry.key === key)
  stack.value = stack.value.filter((entry) => entry.key !== key)
  closed?.onClose?.()
}

export function closeAllPopups(): void {
  stack.value = []
}
