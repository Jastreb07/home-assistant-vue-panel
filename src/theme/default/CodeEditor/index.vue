<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { bracketMatching, syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { autocompletion, completionKeymap } from '@codemirror/autocomplete'
import { css as cssLanguage } from '@codemirror/lang-css'
import { html as htmlLanguage } from '@codemirror/lang-html'
import { javascript as javascriptLanguage } from '@codemirror/lang-javascript'
import { linter, lintGutter, lintKeymap, type Diagnostic } from '@codemirror/lint'
import { tags } from '@lezer/highlight'
import { lintCss } from '@/core/ui/cssLint'

/**
 * CodeMirror 6 based code editor. Colors come from the theme's CSS
 * variables, so it follows the dark/light scheme automatically.
 */
const props = withDefaults(
  defineProps<{
    modelValue: string
    language?: 'css' | 'html' | 'javascript' | 'json'
    minHeight?: string
  }>(),
  { language: 'css', minHeight: '260px' },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const host = ref<HTMLElement | null>(null)
let view: EditorView | null = null

/** Syntax colors — defined as CSS variables in the theme's main.css. */
const highlight = HighlightStyle.define([
  { tag: tags.comment, color: 'var(--code-comment)', fontStyle: 'italic' },
  { tag: tags.propertyName, color: 'var(--code-property)' },
  { tag: [tags.className, tags.tagName, tags.typeName], color: 'var(--code-selector)' },
  { tag: [tags.attributeName, tags.labelName], color: 'var(--code-selector)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--code-string)' },
  { tag: [tags.number, tags.unit, tags.bool], color: 'var(--code-number)' },
  { tag: [tags.keyword, tags.atom, tags.modifier], color: 'var(--code-keyword)' },
  { tag: [tags.function(tags.variableName), tags.definitionKeyword], color: 'var(--code-function)' },
  { tag: tags.punctuation, color: 'var(--text-secondary)' },
  { tag: tags.invalid, color: 'var(--code-invalid)' },
])

const editorTheme = EditorView.theme({
  '&': {
    color: 'var(--text-primary)',
    backgroundColor: 'var(--card-bg)',
    fontSize: '12.5px',
    borderRadius: '10px',
    border: '1px solid var(--divider)',
    overflow: 'hidden',
  },
  '&.cm-focused': { outline: 'none', borderColor: 'var(--accent)' },
  '.cm-content': {
    fontFamily: "'Cascadia Code', Consolas, 'Fira Code', monospace",
    padding: '10px 0',
    caretColor: 'var(--accent)',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    border: 'none',
    opacity: '0.6',
  },
  '.cm-activeLine': { backgroundColor: 'var(--nav-item-hover)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--nav-item-active)',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--nav-bg)',
    border: '1px solid var(--divider)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'var(--nav-item-active)',
    color: 'var(--text-primary)',
  },
})

/** Bridge our css-tree diagnostics into CodeMirror's lint system. */
const cssLinter = linter((v): Diagnostic[] =>
  lintCss(v.state.doc.toString()).map((d) => ({
    from: d.from,
    to: Math.max(d.from + 1, d.to),
    severity: d.severity,
    message: d.message,
  })),
)

function languageExtension(): Extension {
  if (props.language === 'html') return htmlLanguage()
  if (props.language === 'javascript' || props.language === 'json') return javascriptLanguage()
  return cssLanguage()
}

function extensions(): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLine(),
    history(),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    lintGutter(),
    languageExtension(),
    ...(props.language === 'css' ? [cssLinter] : []),
    syntaxHighlighting(highlight),
    editorTheme,
    EditorView.lineWrapping,
    EditorView.theme({ '.cm-scroller': { minHeight: props.minHeight } }),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      ...completionKeymap,
      ...lintKeymap,
      indentWithTab,
    ]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) emit('update:modelValue', update.state.doc.toString())
    }),
  ]
}

onMounted(() => {
  view = new EditorView({
    state: EditorState.create({ doc: props.modelValue, extensions: extensions() }),
    parent: host.value!,
  })
})

// External changes (e.g. "reset to default") — don't fight the user's typing
watch(
  () => props.modelValue,
  (value) => {
    if (!view || value === view.state.doc.toString()) return
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
  },
)

onBeforeUnmount(() => {
  view?.destroy()
  view = null
})
</script>

<template>
  <div ref="host" class="vp-code-editor" />
</template>
