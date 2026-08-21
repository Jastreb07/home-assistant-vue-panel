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

const title = computed(() => {
  if (popup.value) return popup.value.title
  if (props.request.popupId) return t('popups.missingPopup')
  return String(entity.value?.attributes.friendly_name ?? props.request.entityId ?? t('popups.detail'))
})

const icon = computed(() => popup.value?.icon)
/* A detail view holds a single card, so it stays as narrow as that card */
const isLargeDetail = computed(() => props.request.cardType === 'vue-panel/light-detail')
const size = computed(() => (
  popup.value ? DIALOG_SIZE[popup.value.size ?? 'md'] : isLargeDetail.value ? 'lg' : 'md'
))
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
      :class="{ 'is-large-detail': isLargeDetail }"
    >
      <PortableCardHost :card-type="request.cardType" :config="context" />
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
  max-width: 340px;
}
.detail-body.is-large-detail > :deep(*) {
  max-width: 424px;
}
</style>
