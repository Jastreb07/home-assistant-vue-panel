/**
 * Tap actions of a card. The gestures and the possible actions are engine
 * knowledge: a card only narrows the lists down, the panel renders the editor
 * and decides which target a chosen action needs.
 */
export const CARD_GESTURES = ['tap', 'double_tap', 'hold'] as const
export type CardGesture = (typeof CARD_GESTURES)[number]

export const CARD_ACTIONS = [
  'default',
  'more-info',
  'toggle',
  'navigate',
  'url',
  'perform-action',
  'assist',
  'none',
] as const
export type CardAction = (typeof CARD_ACTIONS)[number]

export interface CardActionValue {
  action: CardAction
  /** View id, URL or `domain.service`, depending on the action */
  target?: string
}

export const GESTURE_ICONS: Record<CardGesture, string> = {
  tap: 'mdi:gesture-tap',
  double_tap: 'mdi:gesture-double-tap',
  hold: 'mdi:gesture-tap-hold',
}

/** Which kind of target field an action needs — `none` hides the field. */
export function actionTarget(action: CardAction | string): 'view' | 'url' | 'service' | 'none' {
  if (action === 'navigate') return 'view'
  if (action === 'url') return 'url'
  if (action === 'perform-action') return 'service'
  return 'none'
}
