<script setup lang="ts">
import { computed, provide } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PopupSize, ViewConfig } from '@/core/config/types'
import { useDashboardStore } from '@/core/config/dashboardStore'
import { useMediaQuery } from '@/core/composables/useMediaQuery'
import { useEntity } from '@/core/ha'
import BaseDialog from '@/core/ui/BaseDialog.vue'
import CardCss from '@/core/ui/CardCss.vue'
import FlexLayout from '@/layouts/FlexLayout.vue'
import PortableCardHost from '@/core/custom-cards/PortableCardHost.vue'
import { cardRegistry } from '@/core/registry/cardRegistry'
import EntityDetailFallback from './EntityDetailFallback.vue'
import { popupContextKey } from './popupContext'
import type { PopupRequest } from './popupService'

/**
 * One open dialog: either a custom popup with its own card sections or the
 * detail view of a single entity. The values it was opened with are provided
 * to every card inside it.
 */
const props = defineProps<{ request: PopupRequest }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const store = useDashboardStore()

const context = computed(() => props.request.context)
provide(popupContextKey, context)

const popup = computed(() =>
  props.request.popupId ? store.popupById(props.request.popupId) : undefined)

/** Popup presets map onto the dialog widths the theme already ships. */
const DIALOG_SIZE: Record<PopupSize, 'md' | 'lg' | 'xl' | 'full'> = {
  sm: 'md',
  md: 'lg',
  lg: 'xl',
  full: 'full',
}

const entity = useEntity(() => props.request.entityId ?? '')
const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

/*
 * Temporary remote test footage for the bundled weather detail. Keeping the
 * selection in the frame lets the media cover the header and body as one
 * continuous scene; the portable card itself still owns only its content.
 */
const WEATHER_VIDEOS: Record<string, readonly string[]> = {
  sunny: [
    'https://cdn.flixel.com/flixel/hlhff0h8md4ev0kju5be.hd.mp4',
    'https://cdn.flixel.com/flixel/zjqsoc6ecqhntpl5vacs.hd.mp4',
    'https://cdn.flixel.com/flixel/jvw1avupguhfbo11betq.hd.mp4',
    'https://cdn.flixel.com/flixel/8cmeusxf3pkanai43djs.hd.mp4',
    'https://cdn.flixel.com/flixel/guwb10mfddctfvwioaex.hd.mp4',
  ],
  partlycloudy: [
    'https://cdn.flixel.com/flixel/13e0s6coh6ayapvdyqnv.hd.mp4',
    'https://cdn.flixel.com/flixel/aorl3skmssy7udwopk22.hd.mp4',
    'https://cdn.flixel.com/flixel/qed6wvf2igukiioykg3r.hd.mp4',
    'https://cdn.flixel.com/flixel/3rd72eezaj6d23ahlo7y.hd.mp4',
    'https://cdn.flixel.com/flixel/9m11gd43m6qn3y93ntzp.hd.mp4',
    'https://cdn.flixel.com/flixel/hrkw2m8eofib9sk7t1v2.hd.mp4',
  ],
  cloudy: [
    'https://cdn.flixel.com/flixel/13e0s6coh6ayapvdyqnv.hd.mp4',
    'https://cdn.flixel.com/flixel/aorl3skmssy7udwopk22.hd.mp4',
    'https://cdn.flixel.com/flixel/qed6wvf2igukiioykg3r.hd.mp4',
    'https://cdn.flixel.com/flixel/3rd72eezaj6d23ahlo7y.hd.mp4',
    'https://cdn.flixel.com/flixel/9m11gd43m6qn3y93ntzp.hd.mp4',
    'https://cdn.flixel.com/flixel/hrkw2m8eofib9sk7t1v2.hd.mp4',
  ],
  mostlycloudy: [
    'https://cdn.flixel.com/flixel/e95h5cqyvhnrk4ytqt4q.hd.mp4',
    'https://cdn.flixel.com/flixel/l2bjw34wnusyf5q2qq3p.hd.mp4',
    'https://cdn.flixel.com/flixel/rrgta099ulami3zb9fd2.hd.mp4',
  ],
  'clear-night': [
    'https://cdn.flixel.com/flixel/x9dr8caygivq5secll7i.hd.mp4',
    'https://cdn.flixel.com/flixel/v26zyfd6yf0r33s46vpe.hd.mp4',
    'https://cdn.flixel.com/flixel/ypy8bw9fgw1zv2b4htp2.hd.mp4',
    'https://cdn.flixel.com/flixel/rosz2gi676xhkiw1ut6i.hd.mp4',
  ],
  fog: [
    'https://cdn.flixel.com/flixel/vwqzlk4turo2449be9uf.hd.mp4',
    'https://cdn.flixel.com/flixel/5363uhabodwwrzgnq6vx.hd.mp4',
  ],
  rainy: ['https://cdn.flixel.com/flixel/f0w23bd0enxur5ff0bxz.hd.mp4'],
}

const WEATHER_VIDEO_ALIASES: Record<string, string> = {
  pouring: 'rainy',
  'lightning-rainy': 'rainy',
}

function stableIndex(value: string, length: number): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % length
}

const weatherVideo = computed(() => {
  if (reduceMotion.value || props.request.cardType !== 'vue-panel/weather-detail') return ''
  const state = String(entity.value?.state ?? '')
  const sources = WEATHER_VIDEOS[WEATHER_VIDEO_ALIASES[state] ?? state]
  if (!sources?.length) return ''
  return sources[stableIndex(`${props.request.key}:${props.request.entityId}:${state}`, sources.length)] ?? ''
})

const title = computed(() => {
  if (popup.value) return popup.value.title
  if (props.request.popupId) return t('popups.missingPopup')
  return String(entity.value?.attributes.friendly_name ?? props.request.entityId ?? t('popups.detail'))
})

const icon = computed(() => popup.value?.icon)
/*
 * A detail view holds a single card, so it is as wide as that card says it
 * is — the manifest's `defaultSize.width`. A card that wants the whole
 * dialog simply declares a width that large, which beats naming card types
 * here whenever a new detail card shows up.
 */
const detailWidth = computed(
  () => cardRegistry[props.request.cardType ?? '']?.defaultSize?.width ?? 340,
)
const size = computed(() => (
  popup.value ? DIALOG_SIZE[popup.value.size ?? 'md'] : detailWidth.value >= 424 ? 'lg' : 'md'
))
/*
 * A card as wide as the dialog itself is meant to fill it edge to edge — it
 * then paints its own background and brings its own padding. Narrower cards
 * keep sitting inside the dialog's padding as before.
 */
const isFullBleed = computed(() => detailWidth.value >= 700)
/**
 * A popup lays its cards out exactly like a flex view, so it is rendered
 * through the very same layout — including the whole edit-mode tooling.
 */
const popupView = computed<ViewConfig | null>(() => {
  const entry = popup.value
  if (!entry) return null
  return {
    id: entry.id,
    title: entry.title,
    icon: entry.icon ?? '',
    layout: 'flex',
    align: entry.align,
    padding: entry.padding,
    sections: entry.sections,
  }
})
</script>
<template>
  <BaseDialog
    :title="title"
    :icon="icon"
    :size="size"
    :width="popup?.width"
    :body-height="popup?.height"
    @close="emit('close')"
  >
    <template v-if="weatherVideo" #background>
      <video :key="weatherVideo" autoplay muted loop playsinline preload="auto">
        <source :src="weatherVideo" type="video/mp4">
      </video>
    </template>
    <template v-if="popupView">
      <CardCss :card-id="popupView.id" :css="popup?.css ?? ''">
        <div
          class="popup-body"
          :class="{ 'is-editing': store.editMode }"
          :data-vp-card="popup?.css ? popupView.id : undefined"
        >
          <FlexLayout :view="popupView" area="dialog" />
        </div>
      </CardCss>
    </template>
    <p v-else-if="request.popupId" class="popup-missing">{{ t('popups.missingPopupHint') }}</p>
    <div
      v-else-if="request.cardType"
      class="detail-body"
      :class="{ 'is-full-bleed': isFullBleed }"
      :style="{ '--vp-detail-width': `${detailWidth}px` }"
    >
      <PortableCardHost :card-type="request.cardType" :config="context" area="dialog" />
    </div>
    <EntityDetailFallback v-else :entity-id="request.entityId ?? ''" />
  </BaseDialog>
</template>

<style scoped>
.popup-body {
  min-height: 0;
}
/*
 * Section toolbars hang above their box (`top: -40px`). Without room at the
 * top of the dialog body they are cut off by the dialog header.
 */
.popup-body.is-editing {
  padding-top: 45px;
}
.popup-missing {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}
/* The detail card is a single tile — it stays centred instead of stretching */
.detail-body {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0 4px;
}
.detail-body > :deep(*) {
  width: 100%;
  max-width: var(--vp-detail-width, 340px);
}
/* Cancels the dialog's own padding so the card reaches the dialog edges */
.detail-body.is-full-bleed {
  margin: calc(var(--vp-dialog-padding, 24px) * -1);
  padding: 0;
}
</style>
