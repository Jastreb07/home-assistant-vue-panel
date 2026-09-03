<script setup lang="ts">
import { computed, provide } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PopupSize, ViewConfig } from '@/core/config/types'
import { useDashboardStore } from '@/core/config/dashboardStore'
import { useEntity } from '@/core/ha'
import BaseDialog from '@/core/ui/BaseDialog.vue'
import CardCss from '@/core/ui/CardCss.vue'
import FlexLayout from '@/layouts/FlexLayout.vue'
import PortableCardHost from '@/core/custom-cards/PortableCardHost.vue'
import { cardRegistry } from '@/core/registry/cardRegistry'
import EntityDetailFallback from './EntityDetailFallback.vue'
import { popupCloseKey, popupContextKey } from './popupContext'
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
provide(popupCloseKey, () => emit('close'))

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
    :content-position="request.contentPosition ?? (request.popupId ? 'top' : 'center')"
    :mobile-height="request.mobileHeight ?? (request.popupId ? 'full' : 'fit-content')"
    close-on-backdrop
    @close="emit('close')"
  >
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
  flex: 1;
  min-height: 0;
  align-items: stretch;
  justify-content: flex-start;
  margin: calc(var(--vp-dialog-padding, 24px) * -1);
  padding: 0;
  overflow: hidden;
}
.detail-body.is-full-bleed > :deep(*) {
  min-height: 0;
  max-width: none;
}
</style>
