import { readonly, ref, type Ref } from 'vue'

/**
 * The viewport width as a single app-wide ref: every consumer shares one
 * resize listener, so per-bar breakpoint checks stay cheap.
 */
let width: Ref<number> | null = null

export function useViewportWidth(): Readonly<Ref<number>> {
  if (!width) {
    const state = ref(typeof window === 'undefined' ? 1280 : window.innerWidth)
    width = state
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => (state.value = window.innerWidth))
    }
  }
  return readonly(width)
}
