import type { InjectionKey, Ref } from 'vue'

/** CSS currently applied by the regular per-card CSS editor. */
export const cardCssContextKey: InjectionKey<Readonly<Ref<string>>> = Symbol('card-css')
