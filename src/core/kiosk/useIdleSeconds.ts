import { onScopeDispose, ref, type Ref } from 'vue'

/**
 * Tracks user inactivity. Returns the seconds since the last
 * pointer/key/touch/scroll interaction, updated once per second.
 */
export function useIdleSeconds(): Ref<number> {
  const idleSeconds = ref(0)
  let lastActivity = Date.now()

  const reset = () => {
    lastActivity = Date.now()
    idleSeconds.value = 0
  }

  const events = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'] as const
  for (const e of events) window.addEventListener(e, reset, { passive: true })

  const timer = setInterval(() => {
    idleSeconds.value = Math.floor((Date.now() - lastActivity) / 1000)  
  }, 1000)

  onScopeDispose(() => {
    clearInterval(timer)
    for (const e of events) window.removeEventListener(e, reset)
  })

  return idleSeconds
}
