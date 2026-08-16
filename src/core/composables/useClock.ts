import { onScopeDispose, ref, type Ref } from 'vue'

/** Reactive clock, updated every second. */
export function useClock(): Ref<Date> {
  const now = ref(new Date())
  const timer = setInterval(() => (now.value = new Date()), 1000)
  onScopeDispose(() => clearInterval(timer))
  return now
}
