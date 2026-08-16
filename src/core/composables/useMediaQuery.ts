import { onScopeDispose, ref, type Ref } from 'vue'

/** Reactive matchMedia wrapper for responsive behavior. */
export function useMediaQuery(query: string): Ref<boolean> {
  const mql = window.matchMedia(query)
  const matches = ref(mql.matches)
  const onChange = (e: MediaQueryListEvent) => (matches.value = e.matches)
  mql.addEventListener('change', onChange)
  onScopeDispose(() => mql.removeEventListener('change', onChange))
  return matches
}
