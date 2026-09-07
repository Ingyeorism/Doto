import { createContext, useContext } from "react";
import * as Y from "yjs";
import {
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
  initProseMirrorDoc,
} from "@tiptap/y-tiptap";
import type { FeedbackAnchor, FeedbackSelection } from "./data";
import { writingSchema } from "./editor-schema";

export const toBase64 = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
export const fromBase64 = (s: string) =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export function relativeSelection(
  y: Y.Doc,
  selection: FeedbackSelection,
  mapping: Map<any, any>,
): FeedbackSelection {
  const root = y.getXmlFragment("body");
  const position = (pos: number, assoc: number) => {
    const relative = absolutePositionToRelativePosition(pos, root, mapping);
    const absolute = Y.createAbsolutePositionFromRelativePosition(relative, y);
    return toBase64(
      Y.encodeRelativePosition(
        absolute
          ? Y.createRelativePositionFromTypeIndex(
              absolute.type,
              absolute.index,
              assoc,
            )
          : relative,
      ),
    );
  };
  return {
    ...selection,
    relativeFrom: position(selection.from, 0),
    relativeTo: position(selection.to, -1),
  };
}
export function resolveAnchors(
  y: Y.Doc,
  anchors: FeedbackAnchor[],
  mapping?: Map<any, any>,
): FeedbackAnchor[] {
  const root = y.getXmlFragment("body");
  const map = mapping ?? initProseMirrorDoc(root, writingSchema).mapping;
  return anchors.map((a) => {
    if (!a.relativeFrom || !a.relativeTo) return a;
    try {
      const absolute = (value: string) => {
        const relative = Y.decodeRelativePosition(fromBase64(value));
        const position = relativePositionToAbsolutePosition(
          y,
          root,
          relative,
          map,
        );
        if (position !== null) return position;
        // y-tiptap 3.0.9 rejects all item-based positions at offset 1 as a
        // drag/reorder safeguard. Verify the actual first text node before
        // accepting this legitimate start-of-document boundary.
        const decoded = Y.createAbsolutePositionFromRelativePosition(
          relative,
          y,
        );
        const first = root.toArray()[0];
        return first instanceof Y.XmlElement &&
          ["paragraph", "heading"].includes(first.nodeName) &&
          decoded?.type === first.toArray()[0] &&
          decoded.index === 0
          ? 1
          : null;
      };
      const from = absolute(a.relativeFrom);
      const to = absolute(a.relativeTo);
      return {
        ...a,
        from: from ?? 0,
        to: to ?? 0,
        status:
          from !== null && to !== null && from < to ? "active" : "deleted",
      };
    } catch {
      return { ...a, from: 0, to: 0, status: "deleted" };
    }
  });
}
export const LiveContext = createContext<{
  getDoc: (id: number) => Y.Doc | undefined;
  presence: (
    id: number,
    editing: boolean,
    selection?: FeedbackSelection,
  ) => void;
  clearPresence: (id: number) => void;
  rebaseAnchors: (
    id: number,
    anchors: {
      feedbackId: number;
      oldFrom: string;
      oldTo: string;
      relativeFrom: string;
      relativeTo: string;
    }[],
  ) => void;
} | null>(null);
export const RemoteCursorContext = createContext<{
  docId: number;
  selection?: FeedbackSelection;
} | null>(null);
export const useLive = () => useContext(LiveContext);
