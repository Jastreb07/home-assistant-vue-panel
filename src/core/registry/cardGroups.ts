/**
 * Card picker groups.
 *
 * Deliberately a separate module from cardRegistry: the registry pulls in
 * every manifest.ts via an eager glob, which Vite turns into hoisted
 * static imports. A manifest importing a `const` from the registry would
 * therefore read it before initialization (TDZ). Importing from here has
 * no such cycle.
 */

export interface CardGroup {
  /** Technical, stable — decides the ordering */
  id: string
  /** Shown to the user: an i18n key, or plain text */
  label: string
  /** Runtime catalogs may provide a user-facing label directly. */
  literalLabel?: boolean
}

/** Cards shipped with vue-panel — always listed first in the picker. */
export const NATIVE_GROUP: CardGroup = { id: 'native', label: 'cards.groups.native' }

/** Used for every card whose manifest declares no group. */
export const OTHER_GROUP: CardGroup = { id: 'other', label: 'cards.groups.other' }

/** Native Home Assistant cards, hosted through the overlay bridge. */
export const HASS_GROUP: CardGroup = { id: 'hass', label: 'cards.groups.hass' }
