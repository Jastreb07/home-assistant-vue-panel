<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
 * Colour picker with a saturation/value area, hue and alpha sliders and a
 * text field that accepts (and emits) either hex or rgb/rgba notation.
 * The stored value keeps whichever notation the user picked.
 */
const props = withDefaults(
  defineProps<{
    modelValue: string
    /** Notation used when the value is empty and nothing was typed yet */
    defaultFormat?: ColorFormat
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
    const hsv = rgbToHsv(parsed)
    if (hsv.s > 0 && hsv.v > 0) hue.value = hsv.h
    textDraft.value = null
    format.value = value.trim().toLowerCase().startsWith('rgb') ? 'rgb' : 'hex'
  },
)

const hsv = computed(() => {
  const value = rgbToHsv(rgba.value)
  return { h: hue.value, s: value.s, v: value.v }
})

const text = computed(() => textDraft.value ?? formatColor(rgba.value, format.value))
const preview = computed(() => toCss(rgba.value))
/** Fully saturated hue — the base the saturation/value area is painted over */
const hueCss = computed(() => toCss(hsvToRgb({ h: hue.value, s: 1, v: 1 })))
const alphaTrack = computed(() => {
  const opaque = toCss({ ...rgba.value, a: 1 })
  return `linear-gradient(to right, ${toCss({ ...rgba.value, a: 0 })}, ${opaque})`
})

function commit(next: Rgba) {
  rgba.value = next
  textDraft.value = null
  emit('update:modelValue', formatColor(next, format.value))
}

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
  if (!parsed) return
  rgba.value = parsed
  const next = rgbToHsv(parsed)
  if (next.s > 0 && next.v > 0) hue.value = next.h
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
    commit({ ...picked, a: rgba.value.a })
    hue.value = rgbToHsv(picked).h
  } catch {
    // The user cancelled the eyedropper — nothing to do.
  }
}
</script>

<template>
  <div class="vp-color-picker">
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
</template>
