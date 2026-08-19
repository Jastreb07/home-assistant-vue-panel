import { ref } from 'vue'

/**
 * Promise-based replacements for the native alert()/confirm()/prompt(),
 * rendered by DialogHost.vue using the themed Dialog component.
 *
 *   await alertDialog('Something happened')
 *   if (await confirmDialog('Really delete?')) { ... }
 *   const name = await promptDialog('Title:', 'Default')  // null on cancel
 */

export interface DialogChoice {
  value: string
  label: string
  variant?: 'default' | 'primary' | 'danger'
}

export type DialogRequest =
  | { kind: 'alert'; message: string; resolve: () => void }
  | { kind: 'confirm'; message: string; resolve: (ok: boolean) => void }
  | { kind: 'prompt'; message: string; defaultValue: string; resolve: (value: string | null) => void }
  | { kind: 'choice'; message: string; choices: DialogChoice[]; resolve: (value: string | null) => void }

export const activeDialog = ref<DialogRequest | null>(null)
const queue: DialogRequest[] = []

function enqueue(req: DialogRequest) {
  if (activeDialog.value) queue.push(req)
  else activeDialog.value = req
}

/** Called by DialogHost after resolving the active request. */
export function advanceQueue() {
  activeDialog.value = queue.shift() ?? null
}

export function alertDialog(message: string): Promise<void> {
  return new Promise((resolve) => enqueue({ kind: 'alert', message, resolve }))
}

export function confirmDialog(message: string): Promise<boolean> {
  return new Promise((resolve) => enqueue({ kind: 'confirm', message, resolve }))
}

export function promptDialog(message: string, defaultValue = ''): Promise<string | null> {
  return new Promise((resolve) => enqueue({ kind: 'prompt', message, defaultValue, resolve }))
}

export function choiceDialog(message: string, choices: DialogChoice[]): Promise<string | null> {
  return new Promise((resolve) => enqueue({ kind: 'choice', message, choices, resolve }))
}
