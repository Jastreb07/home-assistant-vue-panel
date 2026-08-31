<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  defaultColor,
  formatColor,
  hsvToRgb,
  parseColor,
  rgbToHsv,
  toCss,
  type ColorFormat,
  type Rgba,
} from '@/core/ui/color'
import MdiIcon from '@/core/ui/MdiIcon.vue'

/**
 * Colour field: a text input for the hex/rgb value plus a swatch button that
 * opens the picker popup (saturation/value area, hue and alpha sliders).
 * The stored value keeps whichever notation the user picked.
 */
const props = withDefaults(
  defineProps<{
    modelValue: string
    /** Notation used when the value is empty and nothing was typed yet */
    defaultFormat?: ColorFormat
    placeholder?: string
  }>(),
  { defaultFormat: 'hex' },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const format = ref<ColorFormat>(
  props.modelValue.trim().toLowerCase().startsWith('rgb') ? 'rgb' : props.defaultFormat,
)

/**
 * Hue is kept separately: it is lost in RGB as soon as saturation or value
 * reach zero, and dragging through black must not reset the hue.
 */
const rgba = ref<Rgba>(parseColor(props.modelValue) ?? { ...defaultColor })
const hue = ref(rgbToHsv(rgba.value).h)
/** What the user is typing — only committed once it parses */
const textDraft = ref<string | null>(null)

watch(
  () => props.modelValue,
  (value) => {
    const parsed = parseColor(value)
    if (!parsed) return
    if (toCss(parsed) === toCss(rgba.value)) return
    rgba.value = parsed
    const hsvValue = rgbToHsv(parsed)
    if (hsvValue.s > 0 && hsvValue.v > 0) hue.value = hsvValue.h
    textDraft.value = null
    format.value = value.trim().toLowerCase().startsWith('rgb') ? 'rgb' : 'hex'
  },
)

const hsv = computed(() => {
  const value = rgbToHsv(rgba.value)
  return { h: hue.value, s: value.s, v: value.v }
})

const text = computed(() =>
  textDraft.value ?? (props.modelValue.trim() ? formatColor(rgba.value, format.value) : ''),
)
const preview = computed(() => toCss(rgba.value))

/**
 * The icon sits on the swatch, so it follows the swatch's brightness —
 * perceived brightness per ITU-R BT.601. A mostly transparent colour shows
 * the checkerboard behind it, which reads as a light background.
 */
const triggerIconColor = computed(() => {
  const { r, g, b, a } = rgba.value
  const onLightBackdrop = a < 0.5 || (r * 299 + g * 587 + b * 114) / 1000 > 150
  return onLightBackdrop ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.85)'
})
/** Fully saturated hue — the base the saturation/value area is painted over */
const hueCss = computed(() => toCss(hsvToRgb({ h: hue.value, s: 1, v: 1 })))
const alphaTrack = computed(
  () => `linear-gradient(to right, ${toCss({ ...rgba.value, a: 0 })}, ${toCss({ ...rgba.value, a: 1 })})`,
)

function commit(next: Rgba) {
  rgba.value = next
  textDraft.value = null
  emit('update:modelValue', formatColor(next, format.value))
}

// ── Popup ────────────────────────────────────────────────────
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const popup = ref<HTMLElement | null>(null)
const open = ref(false)
const popupStyle = ref<Record<string, string>>({})

const POPUP_WIDTH = 236

function positionPopup() {
  const rect = trigger.value?.getBoundingClientRect()
  if (!rect) return
  const width = Math.min(POPUP_WIDTH, window.innerWidth - 16)
  const height = popup.value?.offsetHeight ?? 0
  const gap = 6
  const left = Math.min(window.innerWidth - width - 8, Math.max(8, rect.right - width))
  const top = rect.bottom + height + gap <= window.innerHeight
    ? rect.bottom + gap
    : Math.max(8, rect.top - height - gap)
  popupStyle.value = { left: `${left}px`, top: `${top}px`, width: `${width}px` }
}

async function toggle() {
  open.value = !open.value
  if (!open.value) return
  popupStyle.value = {}
  await nextTick()
  positionPopup()
}

function close() {
  open.value = false
}

function onDocumentPointerDown(event: PointerEvent) {
  const target = event.target as Node
  if (!open.value) return
  if (root.value?.contains(target) || popup.value?.contains(target)) return
  close()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    event.stopPropagation()
    close()
    trigger.value?.focus()
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  window.addEventListener('resize', close)
  window.addEventListener('scroll', close, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  window.removeEventListener('resize', close)
  window.removeEventListener('scroll', close, true)
})

// ── Saturation / value area ──────────────────────────────────
const area = ref<HTMLElement | null>(null)

function pickFromArea(event: PointerEvent) {
  const box = area.value?.getBoundingClientRect()
  if (!box || !box.width || !box.height) return
  const s = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width))
  const v = 1 - Math.min(1, Math.max(0, (event.clientY - box.top) / box.height))
  commit(hsvToRgb({ h: hue.value, s, v }, rgba.value.a))
}

function onAreaDown(event: PointerEvent) {
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  pickFromArea(event)
}

function onAreaMove(event: PointerEvent) {
  if (event.buttons !== 1) return
  pickFromArea(event)
}

// ── Sliders ──────────────────────────────────────────────────
function onHue(event: Event) {
  hue.value = Number((event.target as HTMLInputElement).value)
  commit(hsvToRgb({ h: hue.value, s: hsv.value.s, v: hsv.value.v }, rgba.value.a))
}

function onAlpha(event: Event) {
  commit({ ...rgba.value, a: Number((event.target as HTMLInputElement).value) / 100 })
}

// ── Text field ───────────────────────────────────────────────
function onText(event: Event) {
  const value = (event.target as HTMLInputElement).value
  textDraft.value = value
  const parsed = parseColor(value)
  if (!parsed) {
    // An emptied field clears the setting instead of keeping the last colour
    if (!value.trim()) emit('update:modelValue', '')
    return
  }
  rgba.value = parsed
  const next = rgbToHsv(parsed)
  if (next.s > 0 && next.v > 0) hue.value = next.h
  format.value = value.trim().toLowerCase().startsWith('rgb') ? 'rgb' : 'hex'
  emit('update:modelValue', value.trim())
}

/** Leaving the field with unparsable text restores the last valid colour. */
function onTextBlur() {
  textDraft.value = null
}

function cycleFormat() {
  format.value = format.value === 'hex' ? 'rgb' : 'hex'
  textDraft.value = null
  emit('update:modelValue', formatColor(rgba.value, format.value))
}

// ── Eyedropper (Chromium only) ───────────────────────────────
const eyeDropper = 'EyeDropper' in window
  ? new (window as unknown as { EyeDropper: new () => { open(): Promise<{ sRGBHex: string }> } }).EyeDropper()
  : null

async function pickFromScreen() {
  if (!eyeDropper) return
  try {
    const picked = parseColor((await eyeDropper.open()).sRGBHex)
    if (!picked) return
    hue.value = rgbToHsv(picked).h
    commit({ ...picked, a: rgba.value.a })
  } catch {
    // The user cancelled the eyedropper — nothing to do.
  }
}
</script>

<template>
  <div ref="root" class="vp-color-field" @keydown="onKeydown">
    <input
      class="vp-color-text"
      type="text"
      spellcheck="false"
      :value="text"
      :placeholder="placeholder"
      :aria-label="$t('editor.color.value')"
      @input="onText"
      @blur="onTextBlur"
    />
    <button
      ref="trigger"
      type="button"
      class="vp-color-trigger vp-color-checkers"
      :title="$t('editor.color.open')"
      :aria-label="$t('editor.color.open')"
      :aria-expanded="open"
      @click="toggle"
    >
      <span class="vp-color-trigger-fill" :style="{ background: preview }" />
      <MdiIcon
        class="vp-color-trigger-icon"
        icon="mdi:palette"
        :size="18"
        :style="{ color: triggerIconColor }"
      />
    </button>

    <Teleport to="body">
      <div v-if="open" class="vp-color-popup-layer">
        <div
          ref="popup"
          class="vp-color-popup"
          :style="popupStyle"
          role="dialog"
          @keydown="onKeydown"
        >
          <div
            ref="area"
            class="vp-color-area"
            :style="{ '--vp-color-hue': hueCss }"
            @pointerdown="onAreaDown"
            @pointermove="onAreaMove"
          >
            <span
              class="vp-color-area-handle"
              :style="{
                left: `${hsv.s * 100}%`,
                top: `${(1 - hsv.v) * 100}%`,
                background: toCss({ ...rgba, a: 1 }),
              }"
            />
          </div>

          <div class="vp-color-controls">
            <button
              v-if="eyeDropper"
              type="button"
              class="vp-color-eyedropper"
              :title="$t('editor.color.pickFromScreen')"
              :aria-label="$t('editor.color.pickFromScreen')"
              @click="pickFromScreen"
            >
              <MdiIcon icon="mdi:eyedropper-variant" :size="18" />
            </button>

            <span class="vp-color-preview vp-color-checkers">
              <span class="vp-color-preview-fill" :style="{ background: preview }" />
            </span>

            <div class="vp-color-sliders">
              <input
                class="vp-color-slider vp-color-slider--hue"
                type="range"
                min="0"
                max="360"
                step="1"
                :value="hue"
                :aria-label="$t('editor.color.hue')"
                @input="onHue"
              />
              <span class="vp-color-checkers vp-color-alpha">
                <input
                  class="vp-color-slider vp-color-slider--alpha"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  :value="Math.round(rgba.a * 100)"
                  :style="{ '--vp-color-alpha-track': alphaTrack }"
                  :aria-label="$t('editor.color.alpha')"
                  @input="onAlpha"
                />
              </span>
            </div>
          </div>

          <div class="vp-color-value">
            <input
              class="vp-color-input"
              type="text"
              spellcheck="false"
              :value="text"
              :aria-label="$t('editor.color.value')"
              @input="onText"
              @blur="onTextBlur"
            />
            <button
              type="button"
              class="vp-color-format"
              :title="$t('editor.color.switchFormat')"
              @click="cycleFormat"
            >
              <span>{{ format === 'hex' ? 'HEX' : 'RGB' }}</span>
              <MdiIcon icon="mdi:unfold-more-horizontal" :size="14" />
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
