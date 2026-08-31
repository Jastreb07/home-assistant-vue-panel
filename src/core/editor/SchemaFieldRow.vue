<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CardSchemaField } from '@/core/registry/cardRegistry'
import { cardDisplayName, cardsForArea } from '@/core/registry/cardRegistry'
import type { CardTranslations } from '@/core/registry/portableCardTypes'
import { cardText } from '@/core/registry/cardTranslations'
import { useDashboardStore } from '@/core/config/dashboardStore'
import BaseSelectMenu from '@/core/ui/BaseSelectMenu.vue'
import BaseInput from '@/core/ui/BaseInput.vue'
import BaseCheckbox from '@/core/ui/BaseCheckbox.vue'
import BaseColorPicker from '@/core/ui/BaseColorPicker.vue'
import { mdiIconOptions } from '@/core/ui/mdiIconNames'
import type { SelectOption } from '@/core/ui/selectMenu'
import BaseTapAction from '@/core/ui/BaseTapAction.vue'
import type { CardActionValue, CardGesture } from '@/core/ui/cardActions'
import EntityPicker from './EntityPicker.vue'
import ListField from './ListField.vue'

/** One labelled row of a card's settings form. */
const props = defineProps<{
  field: CardSchemaField
  value: unknown
  /** Catalogs of the card this field belongs to */
  translations?: CardTranslations
}>()
const emit = defineEmits<{ 'update:value': [value: unknown] }>()

const { t, locale } = useI18n()
const store = useDashboardStore()

/** Card-authored text is translated by the card, engine text by the panel. */
const label = computed(() =>
  props.field.literalLabel
    ? cardText(props.translations, props.field.label, locale.value)
    : t(props.field.label),
)

const text = computed(() => (props.value as string | undefined) ?? '')

const checked = computed(() =>
  props.value === undefined ? props.field.default === true : props.value === true,
)

/** Icons are read from the loaded mdi stylesheet — resolved once. */
const iconOptions = computed<SelectOption[]>(() =>
  props.field.type === 'icon' ? mdiIconOptions() : [],
)

const viewOptions = computed<SelectOption[]>(() => [
  { value: '', label: t('editor.noViewTarget') },
  ...store.config.views.map((v) => ({ value: v.id, label: v.title, icon: v.icon })),
])

/** Popups a tap action can open — they are defined once for the whole panel. */
const popupOptions = computed<SelectOption[]>(() => [
  { value: '', label: t('editor.noPopupTarget') },
  ...store.popups.map((popup) => ({
    value: popup.id,
    label: popup.title,
    icon: popup.icon || 'mdi:card-text-outline',
  })),
])

/** Dialog cards a `more-info` action may show instead of the card's default. */
const detailOptions = computed<SelectOption[]>(() => [
  { value: '', label: t('editor.automaticDetail') },
  ...cardsForArea('dialog').map((manifest) => ({
    value: manifest.type,
    label: cardDisplayName(manifest, t, locale.value),
    icon: manifest.icon,
  })),
])

const selectOptions = computed<SelectOption[]>(() =>
  (props.field.options ?? []).map((opt) => ({
    value: opt,
    label: props.field.optionLabels?.[opt]
      ? props.field.literalOptionLabels
        ? cardText(props.translations, props.field.optionLabels[opt], locale.value)
        : t(props.field.optionLabels[opt])
      : opt,
  })),
)

/**
 * SelectMenu renders buttons and Checkbox renders its own <label> —
 * wrapping either in a <label> would forward (and double) clicks.
 */
const plainWrapper = computed(() =>
  ['icon', 'select', 'view', 'popup', 'boolean', 'color', 'list', 'action'].includes(props.field.type),
)

/** Tap actions are stored as one object per gesture. */
const actionValue = computed<Partial<Record<CardGesture, CardActionValue>>>(() => {
  const value = props.value ?? props.field.default
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<Record<CardGesture, CardActionValue>>
    : {}
})
</script>

<template>
  <component
    :is="plainWrapper ? 'div' : 'label'"
    class="field"
    :class="'type-' + field.type"
  >
    <span v-if="field.type !== 'action'" class="label">
      {{ label }}<span v-if="field.required || (!field.optional && field.type === 'entity')"> *</span>
    </span>

    <EntityPicker
      v-if="field.type === 'entity'"
      :model-value="text"
      :domain="field.domain"
      @update:model-value="emit('update:value', $event)"
    />

    <BaseSelectMenu
      v-else-if="field.type === 'icon'"
      :model-value="text"
      :options="iconOptions"
      searchable
      allow-custom
      custom-prefix="mdi:"
      :clearable="field.optional"
      @update:model-value="emit('update:value', $event)"
    />

    <BaseInput
      v-else-if="field.type === 'string'"
      :model-value="text"
      @update:model-value="emit('update:value', $event)"
    />

    <BaseInput
      v-else-if="field.type === 'number'"
      :model-value="(value as number | undefined) ?? (field.default as number | undefined) ?? 0"
      type="number"
      :min="field.min"
      :max="field.max"
      :step="field.step"
      @update:model-value="emit('update:value', Number($event))"
    />

    <BaseColorPicker
      v-else-if="field.type === 'color'"
      :model-value="text || (field.default as string | undefined) || ''"
      @update:model-value="emit('update:value', $event)"
    />

    <BaseCheckbox
      v-else-if="field.type === 'boolean'"
      :model-value="checked"
      @update:model-value="emit('update:value', $event)"
    />

    <BaseSelectMenu
      v-else-if="field.type === 'select'"
      :model-value="text || (field.default as string | undefined) || ''"
      :options="selectOptions"
      @update:model-value="emit('update:value', $event)"
    />

    <BaseSelectMenu
      v-else-if="field.type === 'view'"
      :model-value="text"
      :options="viewOptions"
      :placeholder="t('editor.noViewTarget')"
      @update:model-value="emit('update:value', $event)"
    />

    <BaseSelectMenu
      v-else-if="field.type === 'popup'"
      :model-value="text"
      :options="popupOptions"
      :placeholder="t('editor.noPopupTarget')"
      @update:model-value="emit('update:value', $event)"
    />

    <BaseTapAction
      v-else-if="field.type === 'action'"
      :model-value="actionValue"
      :gestures="field.gestures"
      :actions="field.actions"
      :view-options="viewOptions"
      :popup-options="popupOptions"
      :detail-options="detailOptions"
      @update:model-value="emit('update:value', $event)"
    />

    <ListField
      v-else-if="field.type === 'list'"
      :field="field"
      :translations="translations"
      :model-value="value"
      @update:model-value="emit('update:value', $event)"
    />
  </component>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field.type-boolean {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}
.label {
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
