export default function ({ vue, helpers }) {
  const { onBeforeUnmount, onMounted, ref, watch } = vue
  const { lintCss, loadCodeMirror } = helpers

  /**
   * CodeMirror 6 based code editor. Colors come from the theme's CSS
   * variables, so it follows the dark/light scheme automatically.
   */

  return {
    name: 'CodeEditor',
    props: {
      modelValue: { type: String, required: true },
      language: { type: String, default: 'css' },
      minHeight: { type: String, default: '260px' },
    },
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      const host = ref(null)
      let view = null
      // The component may be unmounted before loadCodeMirror() resolves.
      let disposed = false

      onMounted(async () => {
        // CodeMirror is loaded lazily — everything derived from it is built here.
        const cm = await loadCodeMirror()
        if (disposed || !host.value) return

        /** Syntax colors — defined as CSS variables in the theme's main.css. */
        const highlight = cm.HighlightStyle.define([
          { tag: cm.tags.comment, color: 'var(--code-comment)', fontStyle: 'italic' },
          { tag: cm.tags.propertyName, color: 'var(--code-property)' },
          { tag: [cm.tags.className, cm.tags.tagName, cm.tags.typeName], color: 'var(--code-selector)' },
          { tag: [cm.tags.attributeName, cm.tags.labelName], color: 'var(--code-selector)' },
          { tag: [cm.tags.string, cm.tags.special(cm.tags.string)], color: 'var(--code-string)' },
          { tag: [cm.tags.number, cm.tags.unit, cm.tags.bool], color: 'var(--code-number)' },
          { tag: [cm.tags.keyword, cm.tags.atom, cm.tags.modifier], color: 'var(--code-keyword)' },
          { tag: [cm.tags.function(cm.tags.variableName), cm.tags.definitionKeyword], color: 'var(--code-function)' },
          { tag: cm.tags.punctuation, color: 'var(--text-secondary)' },
          { tag: cm.tags.invalid, color: 'var(--code-invalid)' },
        ])

        const editorTheme = cm.EditorView.theme({
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
        const cssLinter = cm.linter((v) =>
          lintCss(v.state.doc.toString()).map((d) => ({
            from: d.from,
            to: Math.max(d.from + 1, d.to),
            severity: d.severity,
            message: d.message,
          })),
        )

        function languageExtension() {
          if (props.language === 'html') return cm.htmlLanguage()
          if (props.language === 'javascript' || props.language === 'json') return cm.javascriptLanguage()
          return cm.cssLanguage()
        }

        function extensions() {
          return [
            cm.lineNumbers(),
            cm.highlightActiveLine(),
            cm.history(),
            cm.bracketMatching(),
            cm.closeBrackets(),
            cm.autocompletion(),
            cm.lintGutter(),
            languageExtension(),
            ...(props.language === 'css' ? [cssLinter] : []),
            cm.syntaxHighlighting(highlight),
            editorTheme,
            cm.EditorView.lineWrapping,
            cm.EditorView.theme({ '.cm-scroller': { minHeight: props.minHeight } }),
            cm.keymap.of([
              ...cm.closeBracketsKeymap,
              ...cm.defaultKeymap,
              ...cm.historyKeymap,
              ...cm.completionKeymap,
              ...cm.lintKeymap,
              cm.indentWithTab,
            ]),
            cm.EditorView.updateListener.of((update) => {
              if (update.docChanged) emit('update:modelValue', update.state.doc.toString())
            }),
          ]
        }

        view = new cm.EditorView({
          state: cm.EditorState.create({ doc: props.modelValue, extensions: extensions() }),
          parent: host.value,
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
        disposed = true
        view?.destroy()
        view = null
      })

      return { host }
    },
    template: `
  <div ref="host" class="vp-code-editor" />
`,
  }
}
