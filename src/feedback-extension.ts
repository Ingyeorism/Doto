import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { isHistoryTransaction } from "@tiptap/pm/history";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { FeedbackAnchor } from "./data";
import type * as Y from "yjs";
import { resolveAnchors } from "./collaboration";
import { ySyncPluginKey } from "@tiptap/y-tiptap";

type Snapshot = { doc: ProseMirrorNode; anchors: FeedbackAnchor[] };
type AnchorState = { anchors: FeedbackAnchor[]; history: Snapshot[] };
export const feedbackKey = new PluginKey<AnchorState>("dotoFeedback");

// Annotations live outside document marks, so formatting, copy and publication
// cannot erase or copy private feedback. Boundary insertions stay unmarked.
export const FeedbackExtension = Extension.create<{
  anchors: FeedbackAnchor[];
  ydoc?: Y.Doc;
}>({
  name: "dotoFeedback",
  addOptions: () => ({ anchors: [] }),
  addProseMirrorPlugins() {
    const initial = this.options.anchors;
    const ydoc = this.options.ydoc;
    return [
      new Plugin<AnchorState>({
        key: feedbackKey,
        state: {
          init: (_, state) => ({
            anchors: initial,
            history: [{ doc: state.doc, anchors: initial }],
          }),
          apply: (tr, previous, oldState) => {
            const supplied = tr.getMeta(feedbackKey) as
              FeedbackAnchor[] | undefined;
            if (supplied)
              return {
                anchors: supplied,
                history: [
                  ...previous.history,
                  { doc: tr.doc, anchors: supplied },
                ].slice(-160),
              };
            // Live anchors resolve from Yjs identities. Mapping their cached
            // integer positions through editor initialization corrupts ranges.
            if (ydoc) return previous;
            if (!tr.docChanged) return previous;
            let anchors = previous.anchors.map((anchor): FeedbackAnchor => {
              if (anchor.status === "deleted") return anchor;
              let from = anchor.from;
              let to = anchor.to;
              let removed = false;
              // A replacement keeps both boundary positions valid. Inspect
              // removed intervals too, so replacing the entire quote detaches it.
              for (const map of tr.mapping.maps) {
                map.forEach((oldStart, oldEnd) => {
                  if (oldEnd > oldStart && oldStart <= from && oldEnd >= to)
                    removed = true;
                });
                from = map.map(from, 1);
                to = map.map(to, -1);
              }
              if (
                removed ||
                from >= to ||
                !tr.doc.textBetween(from, to, "\n").trim()
              ) {
                return { ...anchor, from, to: from, status: "deleted" };
              }
              return { ...anchor, from, to };
            });
            // Only real undo/redo may restore a deleted anchor. Retyping an equal
            // quote elsewhere never silently reattaches the teacher's message.
            if (isHistoryTransaction(tr)) {
              const match = [...previous.history]
                .reverse()
                .find((s) => s.doc.eq(tr.doc));
              if (match)
                anchors = anchors.map(
                  (a) =>
                    match.anchors.find((b) => b.feedbackId === a.feedbackId) ??
                    a,
                );
            }
            return {
              anchors,
              history: [
                ...previous.history,
                { doc: oldState.doc, anchors: previous.anchors },
                { doc: tr.doc, anchors },
              ].slice(-160),
            };
          },
        },
        props: {
          decorations(state) {
            const saved = feedbackKey.getState(state)?.anchors ?? [];
            const current = ydoc
              ? resolveAnchors(
                  ydoc,
                  saved,
                  ySyncPluginKey.getState(state)?.binding.mapping,
                )
              : saved;
            const anchors = current.filter(
              (a) =>
                a.status === "active" &&
                a.from >= 0 &&
                a.from < a.to &&
                a.to <= state.doc.content.size,
            );
            // Split overlaps into intervals: every message remains reachable even
            // when ProseMirror would otherwise merge equal-range DOM attributes.
            const boundaries = [
              ...new Set(anchors.flatMap((a) => [a.from, a.to])),
            ].sort((a, b) => a - b);
            return DecorationSet.create(
              state.doc,
              boundaries.flatMap((from, i) => {
                const to = boundaries[i + 1];
                if (to === undefined) return [];
                const ids = anchors
                  .filter((a) => a.from <= from && a.to >= to)
                  .map((a) => a.feedbackId);
                return ids.length
                  ? [
                      Decoration.inline(
                        from,
                        to,
                        {
                          class: `feedback-highlight${ids.length > 1 ? " overlapping-feedback" : ""}`,
                          "data-feedback-id": String(ids[0]),
                          "data-feedback-ids": ids.join(" "),
                          tabindex: "0",
                          role: "button",
                          "aria-label": `선생님 피드백 ${ids.length}개 보기`,
                          "aria-haspopup": "dialog",
                        },
                        { inclusiveStart: false, inclusiveEnd: false },
                      ),
                    ]
                  : [];
              }),
            );
          },
        },
      }),
    ];
  },
});
