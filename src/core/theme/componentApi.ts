import * as vue from 'vue'
import { defineAsyncComponent, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import MdiIcon from '@/core/ui/MdiIcon.vue'
import { dialogPointerPosition } from '@/core/ui/dialogPointer'
import { useMediaQuery } from '@/core/composables/useMediaQuery'
import { useDashboardStore } from '@/core/config/dashboardStore'
import { boxSides, boxUnits } from '@/core/ui/boxInput'
import { isParentView, viewDepth } from '@/core/ui/viewSelect'
import {
  defaultColor,
  formatColor,
  hsvToRgb,
  parseColor,
  rgbToHsv,
  toCss,
} from '@/core/ui/color'
import {
  CARD_ACTION_OPTIONS,
  CARD_GESTURES,
  GESTURE_ICONS,
  actionTarget,
} from '@/core/ui/cardActions'
import { lintCss } from '@/core/ui/cssLint'

/**
 * The stable runtime API handed to every theme component factory.
 *
 * Theme components are plain ES modules loaded at runtime — they cannot use
 * bare imports, so everything they need is provided through this object:
 * the full Vue namespace (templates are compiled at runtime), vue-i18n's
 * useI18n, the engine's base UI components and a set of engine helpers.
 */
export interface ThemeComponentApi {
  vue: typeof vue
  useI18n: typeof useI18n
  components: Record<string, Component>
  helpers: Record<string, unknown>
}

/**
 * The Base* wrappers resolve through the theme registry, which itself hands
 * out this API — lazy components break that module cycle.
 */
function lazy(loader: () => Promise<{ default: Component }>): Component {
  return defineAsyncComponent(loader)
}

/** CodeMirror stays in its own lazy chunk — themes load it on demand. */
async function loadCodeMirror(): Promise<Record<string, unknown>> {
  const [state, view, commands, language, autocomplete, langCss, langHtml, langJs, lint, highlight] =
    await Promise.all([
      import('@codemirror/state'),
      import('@codemirror/view'),
      import('@codemirror/commands'),
      import('@codemirror/language'),
      import('@codemirror/autocomplete'),
      import('@codemirror/lang-css'),
      import('@codemirror/lang-html'),
      import('@codemirror/lang-javascript'),
      import('@codemirror/lint'),
      import('@lezer/highlight'),
    ])
  return {
    EditorState: state.EditorState,
    EditorView: view.EditorView,
    keymap: view.keymap,
    lineNumbers: view.lineNumbers,
    highlightActiveLine: view.highlightActiveLine,
    defaultKeymap: commands.defaultKeymap,
    history: commands.history,
    historyKeymap: commands.historyKeymap,
    indentWithTab: commands.indentWithTab,
    bracketMatching: language.bracketMatching,
    syntaxHighlighting: language.syntaxHighlighting,
    HighlightStyle: language.HighlightStyle,
    closeBrackets: autocomplete.closeBrackets,
    closeBracketsKeymap: autocomplete.closeBracketsKeymap,
    autocompletion: autocomplete.autocompletion,
    completionKeymap: autocomplete.completionKeymap,
    cssLanguage: langCss.css,
    htmlLanguage: langHtml.html,
    javascriptLanguage: langJs.javascript,
    linter: lint.linter,
    lintGutter: lint.lintGutter,
    lintKeymap: lint.lintKeymap,
    tags: highlight.tags,
  }
}

let api: ThemeComponentApi | null = null

/** Build the singleton API object shared by all theme component factories. */
export function themeComponentApi(): ThemeComponentApi {
  if (!api) {
    api = {
      vue,
      useI18n,
      components: {
        MdiIcon,
        BaseAddTile: lazy(() => import('@/core/ui/BaseAddTile.vue')),
        BaseBoxInput: lazy(() => import('@/core/ui/BaseBoxInput.vue')),
        BaseButton: lazy(() => import('@/core/ui/BaseButton.vue')),
        BaseCard: lazy(() => import('@/core/ui/BaseCard.vue')),
        BaseCardEditOverlay: lazy(() => import('@/core/ui/BaseCardEditOverlay.vue')),
        BaseCheckbox: lazy(() => import('@/core/ui/BaseCheckbox.vue')),
        BaseCodeEditor: lazy(() => import('@/core/ui/BaseCodeEditor.vue')),
        BaseCollapsible: lazy(() => import('@/core/ui/BaseCollapsible.vue')),
        BaseCollapsibleAdvanced: lazy(() => import('@/core/ui/BaseCollapsibleAdvanced.vue')),
        BaseColorPicker: lazy(() => import('@/core/ui/BaseColorPicker.vue')),
        BaseDialog: lazy(() => import('@/core/ui/BaseDialog.vue')),
        BaseEditableArea: lazy(() => import('@/core/ui/BaseEditableArea.vue')),
        BaseEditableAreaButton: lazy(() => import('@/core/ui/BaseEditableAreaButton.vue')),
        BaseInput: lazy(() => import('@/core/ui/BaseInput.vue')),
        BaseSelectMenu: lazy(() => import('@/core/ui/BaseSelectMenu.vue')),
        BaseSplitter: lazy(() => import('@/core/ui/BaseSplitter.vue')),
        BaseTabs: lazy(() => import('@/core/ui/BaseTabs.vue')),
        BaseTapAction: lazy(() => import('@/core/ui/BaseTapAction.vue')),
        BaseViewSelectMenu: lazy(() => import('@/core/ui/BaseViewSelectMenu.vue')),
      },
      helpers: {
        dialogPointerPosition,
        useMediaQuery,
        useDashboardStore,
        boxSides,
        boxUnits,
        isParentView,
        viewDepth,
        defaultColor,
        formatColor,
        hsvToRgb,
        parseColor,
        rgbToHsv,
        toCss,
        CARD_ACTION_OPTIONS,
        CARD_GESTURES,
        GESTURE_ICONS,
        actionTarget,
        lintCss,
        loadCodeMirror,
      },
    }
  }
  return api
}
