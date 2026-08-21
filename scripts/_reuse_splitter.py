"""Temporary helper: the custom-card dialog reuses the themed splitter."""

import io
import re

p = 'src/core/custom-cards/CustomCardDialog.vue'
s = io.open(p, encoding='utf-8', newline='').read()
nl = "\r\n" if "\r\n" in s else "\n"


def b(text):
    return text.replace("\n", nl)


def patch(old, new):
    global s
    assert b(old) in s, old[:70]
    s = s.replace(b(old), b(new), 1)


def drop(pattern):
    global s
    updated, count = re.subn(pattern, "", s, flags=re.S)
    assert count == 1, pattern[:60]
    s = updated


# The drag logic now lives in the themed component
drop(r"function setEditorShare\(value: number\) \{.*?\n\}\r?\n\r?\n")
drop(r"function updateEditorShare\(clientX: number\) \{.*?\n\}\r?\n\r?\n")
drop(r"function startSplitter\(event: PointerEvent\) \{.*?\n\}\r?\n\r?\n")
drop(r"function moveSplitter\(event: PointerEvent\) \{.*?\n\}\r?\n\r?\n")
drop(r"function stopSplitter\(event: PointerEvent\) \{.*?\n\}\r?\n\r?\n")
drop(r"function resizeWithKeyboard\(event: KeyboardEvent\) \{.*?\n\}\r?\n\r?\n")
drop(r"\.editor-preview-splitter \{.*?\n\}\r?\n\r?\n")
drop(r"\.editor-preview-splitter::before \{.*?\n\}\r?\n\r?\n")
drop(r"\.editor-preview-splitter > span \{.*?\n\}\r?\n\r?\n")
drop(
    r"\.editor-preview-splitter:hover::before,\r?\n"
    r"\.editor-preview-splitter:focus-visible::before,\r?\n"
    r"\.custom-editor-layout\.is-resizing \.editor-preview-splitter::before \{.*?\n\}\r?\n\r?\n"
)
drop(r"\.editor-preview-splitter:focus-visible > span \{.*?\n\}\r?\n\r?\n")

patch("""      <div
          class="editor-preview-splitter"
          role="separator"
          aria-orientation="vertical"
          :aria-label="t('customCards.resizePreview')"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="Math.round(editorShare)"
          tabindex="0"
          @keydown="resizeWithKeyboard"
          @pointerdown.prevent="startSplitter"
          @pointermove.prevent="moveSplitter"
          @pointerup="stopSplitter"
          @pointercancel="stopSplitter"
      >
        <span/>
      </div>""",
      """      <BaseSplitter
          v-model:share="editorShare"
          :label="t('customCards.resizePreview')"
          @update:dragging="splitterDragging = $event"
      />""")

patch("""import BaseCollapsible from '@/core/ui/BaseCollapsible.vue'""",
      """import BaseCollapsible from '@/core/ui/BaseCollapsible.vue'
import BaseSplitter from '@/core/ui/BaseSplitter.vue'""")

patch("""  .editor-preview-splitter {
    display: none;
  }""",
      """  .custom-editor-layout :deep(.vp-splitter) {
    display: none;
  }""")

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('custom card dialog reuses the themed splitter')
