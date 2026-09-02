export interface DialogPointerPosition {
  x: number
  y: number
}

let latestPointer: (DialogPointerPosition & { timestamp: number }) | undefined
let tracking = false

/** Track the pointer before a click creates a dialog. */
export function startDialogPointerTracking(): void {
  if (tracking) return
  tracking = true
  window.addEventListener('pointerdown', (event) => {
    latestPointer = {
      x: event.clientX,
      y: event.clientY,
      timestamp: performance.now(),
    }
  }, { capture: true, passive: true })
}

/** Keyboard-triggered dialogs originate in the viewport center. */
export function dialogPointerPosition(): DialogPointerPosition {
  if (latestPointer && performance.now() - latestPointer.timestamp < 1500) {
    return latestPointer
  }
  return {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  }
}
