export default function ({ vue, useI18n, components, helpers }) {
  const { computed } = vue
  const { CARD_ACTION_OPTIONS, CARD_GESTURES, GESTURE_ICONS, actionTarget } = helpers

  /**
   * Editor for the tap, double tap and hold action of a card. Which gestures
   * and actions are offered comes from the card; everything else — the labels,
   * the target field and when it is shown — is the panel's business.
   */
  return {
    name: 'TapAction',
    components: {
      BaseCollapsible: components.BaseCollapsible,
      BaseSelectMenu: components.BaseSelectMenu,
      BaseInput: components.BaseInput,
    },
    props: {
      modelValue: { type: Object, default: undefined },
      gestures: { type: Array, default: undefined },
      actions: { type: Array, default: undefined },
      /** Views the `navigate` action can point at */
      viewOptions: { type: Array, default: undefined },
      /** Popups the `popup` action can open */
      popupOptions: { type: Array, default: undefined },
      /** Dialog cards the `more-info` action may show instead of the default */
      detailOptions: { type: Array, default: undefined },
    },
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      const { t } = useI18n()

      const gestures = computed(() =>
        props.gestures?.length ? props.gestures : [...CARD_GESTURES],
      )

      const actionOptions = computed(() =>
        [...new Set(
          (props.actions?.length ? props.actions : CARD_ACTION_OPTIONS)
            .map((action) => action === 'default' ? 'more-info' : action),
        )].map((action) => ({
            value: action,
            label: t(`editor.cardActionOptions.${action}`),
          })),
      )

      function entry(gesture) {
        const value = props.modelValue?.[gesture]
        return !value || value.action === 'default' ? { action: 'more-info' } : value
      }

      function update(gesture, patch) {
        const next = { ...props.modelValue }
        next[gesture] = { ...entry(gesture), ...patch }
        emit('update:modelValue', next)
      }

      function setAction(gesture, action) {
        // A different action means a different kind of target, so it starts empty
        update(gesture, { action: action, target: '' })
      }

      return { t, gestures, actionOptions, GESTURE_ICONS, actionTarget, entry, update, setAction }
    },
    template: `
  <div class="vp-tap-action">
    <BaseCollapsible
      v-for="gesture in gestures"
      :key="gesture"
      :title="t(\`editor.cardGestures.\${gesture}\`)"
      :icon="GESTURE_ICONS[gesture]"
    >
      <div class="vp-tap-action-body">
        <label class="vp-tap-action-field">
          <span>{{ t(\`editor.cardGestures.\${gesture}\`) }}</span>
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

        <label v-else-if="actionTarget(entry(gesture).action) === 'popup'" class="vp-tap-action-field">
          <span>{{ t('editor.cardActionTargets.popup') }}</span>
          <BaseSelectMenu
            :model-value="entry(gesture).target ?? ''"
            :options="popupOptions ?? []"
            searchable
            @update:model-value="update(gesture, { target: String($event) })"
          />
        </label>

        <label v-else-if="actionTarget(entry(gesture).action) === 'detail'" class="vp-tap-action-field">
          <span>{{ t('editor.cardActionTargets.detail') }}</span>
          <BaseSelectMenu
            :model-value="entry(gesture).target ?? ''"
            :options="detailOptions ?? []"
            searchable
            @update:model-value="update(gesture, { target: String($event) })"
          />
        </label>
      </div>
    </BaseCollapsible>
  </div>
    `,
  }
}
