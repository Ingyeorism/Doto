import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { ySyncPluginKey } from "@tiptap/y-tiptap";
import type * as Y from "yjs";
import type { FeedbackSelection } from "./data";
import { resolveAnchors } from "./collaboration";
export const caretKey = new PluginKey<FeedbackSelection | null>("teacherCaret");
export const RemoteCaret = Extension.create<{ ydoc: Y.Doc }>({
  name: "teacherCaret",
  addProseMirrorPlugins() {
    const ydoc = this.options.ydoc;
    return [
      new Plugin<FeedbackSelection | null>({
        key: caretKey,
        state: {
          init: () => null,
          apply: (tr, prev) =>
            tr.getMeta(caretKey) === undefined ? prev : tr.getMeta(caretKey),
        },
        props: {
          decorations(state) {
            const selection = caretKey.getState(state);
            if (!selection?.relativeTo) return DecorationSet.empty;
            const [range] = resolveAnchors(
              ydoc,
              [{ ...selection, feedbackId: -1, status: "active" }],
              ySyncPluginKey.getState(state)?.binding.mapping,
            );
            if (range.to < 1 || range.to > state.doc.content.size)
              return DecorationSet.empty;
            return DecorationSet.create(state.doc, [
              Decoration.widget(
                range.to,
                () => {
                  const el = document.createElement("span");
                  el.className = "remote-teacher-caret";
                  el.setAttribute("aria-label", "선생님 커서");
                  return el;
                },
                { side: 1 },
              ),
            ]);
          },
        },
      }),
    ];
  },
});
