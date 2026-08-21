<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseCollapsible from '@/core/ui/BaseCollapsible.vue'
import BaseSelectMenu from '@/core/ui/BaseSelectMenu.vue'
import BaseInput from '@/core/ui/BaseInput.vue'
import type { SelectOption } from '@/core/ui/selectMenu'
import {
  CARD_ACTIONS,
  CARD_GESTURES,
  GESTURE_ICONS,
  actionTarget,
  type CardAction,
  type CardActionValue,
  type CardGesture,
} from '@/core/ui/cardActions'

/**
 * Editor for the tap, double tap and hold action of a card. Which gestures
 * and actions are offered comes from the card; everything else — the labels,
 * the target field and when it is shown — is the panel's business.
 */
const props = defineProps<{
  modelValue: Partial<Record<CardGesture, CardActionValue>>
  gestures?: CardGesture[]
  actions?: CardAction[]
  /** Views the `navigate` action can point at */
  viewOptions: SelectOption[]
}>()
const emit = defineEmits<{
  'update:modelValue': [value: Partial<Record<CardGesture, CardActionValue>>]
}>()

const { t } = useI18n()

const gestures = computed<CardGesture[]>(() =>
  props.gestures?.length ? props.gestures : [...CARD_GESTURES],
)

const actionOptions = computed<SelectOption[]>(() =>
  (props.actions?.length ? props.actions : [...CARD_ACTIONS]).map((action) => ({
    value: action,
    label: t(`editor.cardActionOptions.${action}`),
  })),
)

function entry(gesture: CardGesture): CardActionValue {
  return props.modelValue?.[gesture] ?? { action: 'default' }
}

function update(gesture: CardGesture, patch: Partial<CardActionValue>) {
  const next = { ...props.modelValue }
  next[gesture] = { ...entry(gesture), ...patch }
  emit('update:modelValue', next)
}

function setAction(gesture: CardGesture, action: string) {
  // A different action means a different kind of target, so it starts empty
  update(gesture, { action: action as CardAction, target: '' })
}
</script>

<template>
  <div class="vp-tap-action">
    <BaseCollapsible
      v-for="gesture in gestures"
      :key="gesture"
      :title="t(`editor.cardGestures.${gesture}`)"
      :icon="GESTURE_ICONS[gesture]"
    >
      <div class="vp-tap-action-body">
        <label class="vp-tap-action-field">
          <span>{{ t(`editor.cardGestures.${gesture}`) }}</span>
          <BaseSelectMenu
            :model-value="entry(gesture).action"
            :options="actionOptions"
            @update:model-value="setAction(gesture, String($event))"
          />
        </label>

        <label v-if="actionTarget(entry(gesture).action) === 'view'" class="vp-tap-action-field">
          <span>{{ t('editor.cardActionTargets.view') }}</span>
          <BaseSelectMenu
            :model-value="entry(gesture).target ?? ''"
            :options="viewOptions"
            searchable
            @update:model-value="update(gesture, { target: String($event) })"
          />
        </label>

        <label v-else-if="actionTarget(entry(gesture).action) === 'url'" class="vp-tap-action-field">
          <span>{{ t('editor.cardActionTargets.url') }}</span>
          <BaseInput
            :model-value="entry(gesture).target ?? ''"
            placeholder="https://example.com"
            :spellcheck="false"
            @update:model-value="update(gesture, { target: String($event) })"
          />
        </label>

        <label v-else-if="actionTarget(entry(gesture).action) === 'service'" class="vp-tap-action-field">
          <span>{{ t('editor.cardActionTargets.service') }}</span>
          <BaseInput
            :model-value="entry(gesture).target ?? ''"
            placeholder="light.turn_on"
            :spellcheck="false"
            @update:model-value="update(gesture, { target: String($event) })"
          />
        </label>
      </div>
    </BaseCollapsible>
  </div>
</template>
