import { useContext, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import Collaboration from "@tiptap/extension-collaboration";
import { ySyncPluginKey } from "@tiptap/y-tiptap";
import { ParagraphIndent } from "./editor-schema";
import {
  useLive,
  relativeSelection,
  resolveAnchors,
  RemoteCursorContext,
} from "./collaboration";
import { RemoteCaret, caretKey } from "./remote-caret";
import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Undo2,
  Underline,
} from "lucide-react";
import {
  type Feedback,
  type FeedbackSelection,
  type StudentDoc,
  DOCUMENT_TITLE_MAX_LENGTH,
  toHtml,
} from "./data";
import { FeedbackExtension, feedbackKey } from "./feedback-extension";
import { FeedbackSurface } from "./FeedbackSurface";

export function WritingEditor({
  doc,
  onUpdate,
  compact = false,
  feedback = [],
  readOnly = false,
  onCreateFeedback,
  onFeedbackResponse,
  feedbackRole,
  saveLabel,
  presenceLabel,
}: {
  doc: StudentDoc;
  onUpdate: (changes: Partial<StudentDoc>) => void;
  compact?: boolean;
  feedback?: Feedback[];
  readOnly?: boolean;
  onCreateFeedback?: (message: string, selection: FeedbackSelection) => void;
  onFeedbackResponse?: (id: number, response: Feedback["response"]) => void;
  feedbackRole?: "teacher" | "student";
  saveLabel?: string;
  presenceLabel?: string;
}) {
  const live = useLive();
  const ydoc = live?.getDoc(doc.id);
  const remoteCursor = useContext(RemoteCursorContext);
  const docRef = useRef(doc);
  docRef.current = doc;
  const [more, setMore] = useState(false);
  const titleComposing = useRef(false);
  const [composingTitle, setComposingTitle] = useState<string | null>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const [fontSize, setFontSize] = useState("18");
  const [fontFamily, setFontFamily] = useState("sans-serif");
  const [selectionMenu, setSelectionMenu] = useState<{
    range: FeedbackSelection;
    left: number;
    top: number;
  } | null>(null);
  const [pending, setPending] = useState<FeedbackSelection | null>(null);
  const pendingRef = useRef<FeedbackSelection | null>(null);
  const [message, setMessage] = useState("");
  const callbacks = useRef({ onUpdate, onCreateFeedback });
  callbacks.current = { onUpdate, onCreateFeedback };
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: false,
        ...(ydoc ? { undoRedo: false } : {}),
      }),
      ...(ydoc
        ? [Collaboration.configure({ document: ydoc, field: "body" })]
        : []),
      ...(ydoc ? [RemoteCaret.configure({ ydoc })] : []),
      TextStyleKit.configure({ lineHeight: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      ParagraphIndent,
      FeedbackExtension.configure({ anchors: doc.anchors, ydoc }),
    ],
    content: ydoc ? undefined : toHtml(doc),
    editable: !readOnly,
    shouldRerenderOnTransaction: true,
    editorProps: {
      handleScrollToSelection: (view) => {
        if (compact || !view.editable) return false;
        const rect = view.coordsAtPos(view.state.selection.head);
        const viewport = window.visualViewport;
        const top = (viewport?.offsetTop ?? 0) + 90;
        const bottom =
          (viewport
            ? viewport.offsetTop + viewport.height
            : window.innerHeight) - 24;
        if (rect.bottom > bottom) window.scrollBy(0, rect.bottom - bottom);
        else if (rect.top < top) window.scrollBy(0, rect.top - top);
        return true;
      },
      attributes: {
        "aria-label": `${doc.name}의 글 본문`,
        role: "textbox",
        "aria-multiline": "true",
        spellcheck: "false",
      },
    },
    onUpdate: ({ editor: current }) =>
      callbacks.current.onUpdate({
        html: current.getHTML(),
        anchors: feedbackKey.getState(current.state)?.anchors ?? [],
        paragraphs: current.getText({ blockSeparator: "\n" }).split("\n"),
      }),
    onSelectionUpdate: ({ editor: current }) => {
      if (callbacks.current.onCreateFeedback && !pendingRef.current) {
        const { from, to } = current.state.selection;
        const quote = current.state.doc.textBetween(from, to, "\n");
        if (from < to && quote.trim()) {
          const rect = current.view.coordsAtPos(to);
          setSelectionMenu({
            range: ydoc
              ? relativeSelection(
                  ydoc,
                  { from, to, quote },
                  ySyncPluginKey.getState(current.state).binding.mapping,
                )
              : { from, to, quote },
            left: Math.max(12, Math.min(rect.left, window.innerWidth - 160)),
            top: Math.max(
              12,
              Math.min(rect.bottom + 8, window.innerHeight - 54),
            ),
          });
        } else setSelectionMenu(null);
      }
      if (live && feedbackRole === "teacher") {
        const { from, to } = current.state.selection;
        live.presence(
          doc.id,
          !readOnly,
          ydoc
            ? relativeSelection(
                ydoc,
                { from, to, quote: "" },
                ySyncPluginKey.getState(current.state).binding.mapping,
              )
            : undefined,
        );
      }
      setFontSize(
        String(current.getAttributes("textStyle").fontSize || "18px").replace(
          "px",
          "",
        ),
      );
      setFontFamily(
        current.getAttributes("textStyle").fontFamily || "sans-serif",
      );
    },
    onTransaction: ({ transaction, editor: current }) => {
      if (
        ydoc &&
        live &&
        transaction.getMeta(ySyncPluginKey)?.isUndoRedoOperation
      )
        queueMicrotask(() => {
          if (current.isDestroyed) return;
          const mapping = ySyncPluginKey.getState(current.state).binding
            .mapping;
          const anchors = resolveAnchors(ydoc, docRef.current.anchors, mapping)
            .filter(
              (a) => a.status === "active" && a.relativeFrom && a.relativeTo,
            )
            .map((a) => {
              const next = relativeSelection(
                ydoc,
                { from: a.from, to: a.to, quote: "" },
                mapping,
              );
              return {
                feedbackId: a.feedbackId,
                oldFrom: a.relativeFrom!,
                oldTo: a.relativeTo!,
                relativeFrom: next.relativeFrom!,
                relativeTo: next.relativeTo!,
              };
            })
            .filter(
              (a) => a.relativeFrom !== a.oldFrom || a.relativeTo !== a.oldTo,
            );
          if (anchors.length) live.rebaseAnchors(doc.id, anchors);
        });
      if (!transaction.docChanged) return;
      setSelectionMenu(null);
      const range = pendingRef.current;
      if (range) {
        const resolved =
          ydoc && range.relativeFrom
            ? resolveAnchors(
                ydoc,
                [{ ...range, feedbackId: -1, status: "active" }],
                ySyncPluginKey.getState(current.state)?.binding.mapping,
              )[0]
            : null;
        const from = resolved?.from ?? transaction.mapping.map(range.from, 1);
        const to = resolved?.to ?? transaction.mapping.map(range.to, -1);
        const next =
          from < to ? { ...range, from, to, quote: range.quote } : null;
        pendingRef.current = next;
        setPending(next);
      }
    },
  });
  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);
  useEffect(() => {
    if (editor && ydoc)
      editor.view.dispatch(
        editor.state.tr
          .setMeta(
            caretKey,
            remoteCursor?.docId === doc.id
              ? (remoteCursor.selection ?? null)
              : null,
          )
          .setMeta("addToHistory", false),
      );
  }, [editor, ydoc, doc.id, remoteCursor]);
  useEffect(() => {
    if (live && feedbackRole === "teacher") {
      live.presence(doc.id, !readOnly);
      return () => live.clearPresence(doc.id);
    }
  }, [live, doc.id, readOnly, feedbackRole]);
  useEffect(() => {
    if (!editor) return;
    const anchors = feedbackKey.getState(editor.state)?.anchors ?? [];
    if (JSON.stringify(anchors) !== JSON.stringify(doc.anchors)) {
      editor.view.dispatch(
        editor.state.tr
          .setMeta(feedbackKey, doc.anchors)
          .setMeta("addToHistory", false),
      );
    }
  }, [editor, doc.anchors]);
  useEffect(() => {
    const hide = () => setSelectionMenu(null);
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        hide();
        pendingRef.current = null;
        setPending(null);
        setMessage("");
      }
    };
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  if (!editor) return null;
  const tool = (
    label: string,
    icon: React.ReactNode,
    action: () => void,
    active = false,
    disabled = false,
  ) => (
    <button
      type="button"
      className={`format-button ${active ? "active" : ""}`}
      aria-label={label}
      title={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={action}
      disabled={disabled}
    >
      {icon}
    </button>
  );
  const indent = (amount: number) => {
    const type = editor.isActive("heading") ? "heading" : "paragraph";
    editor
      .chain()
      .focus()
      .updateAttributes(type, {
        indent: Math.max(
          0,
          Math.min(6, (editor.getAttributes(type).indent || 0) + amount),
        ),
      })
      .run();
  };
  return (
    <div
      className={`writing-editor ${compact ? "compact-editor" : ""} ${readOnly ? "reader-editor" : ""}`}
    >
      {!readOnly && (
        <div className="editor-toolbar" role="toolbar" aria-label="글쓰기 도구">
          <div className="tool-group">
            <label className="font-select">
              <span className="sr-only">글꼴</span>
              <select
                aria-label="글꼴"
                value={fontFamily}
                onChange={(e) => {
                  setFontFamily(e.target.value);
                  editor.chain().focus().setFontFamily(e.target.value).run();
                }}
              >
                <option value="sans-serif">고딕</option>
                <option value="serif">명조</option>
                <option value="monospace">고정폭</option>
              </select>
            </label>
            <label className="size-select">
              <span className="sr-only">글자 크기</span>
              <select
                aria-label="글자 크기"
                value={fontSize}
                onChange={(e) => {
                  setFontSize(e.target.value);
                  editor
                    .chain()
                    .focus()
                    .setFontSize(`${e.target.value}px`)
                    .run();
                }}
              >
                {["14", "16", "18", "20", "24", "28", "32", "40"].map(
                  (size) => (
                    <option key={size}>{size}</option>
                  ),
                )}
              </select>
            </label>
          </div>
          <div className="tool-group">
            {tool(
              "굵게",
              <Bold size={18} />,
              () => {
                editor.chain().focus().toggleBold().run();
              },
              editor.isActive("bold"),
            )}
            {tool(
              "기울임",
              <Italic size={18} />,
              () => {
                editor.chain().focus().toggleItalic().run();
              },
              editor.isActive("italic"),
            )}
            {tool(
              "밑줄",
              <Underline size={18} />,
              () => {
                editor.chain().focus().toggleUnderline().run();
              },
              editor.isActive("underline"),
            )}
            <div className="color-control">
              <button
                type="button"
                className="format-button color-letter"
                aria-label="글자색"
                title="글자색"
                aria-expanded={colorOpen}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setColorOpen(!colorOpen)}
              >
                <span
                  style={{
                    borderColor:
                      editor.getAttributes("textStyle").color || "#355c45",
                  }}
                >
                  가
                </span>
                <ChevronDown size={11} />
              </button>
              {colorOpen && (
                <div className="color-popover" aria-label="글자색 선택">
                  {[
                    ["#30392f", "기본"],
                    ["#315b45", "초록"],
                    ["#b35742", "주황"],
                    ["#3d668b", "파랑"],
                    ["#805a85", "보라"],
                    ["#8b682d", "갈색"],
                  ].map(([color, label]) => (
                    <button
                      type="button"
                      key={color}
                      aria-label={`${label} 글자색`}
                      title={label}
                      style={{ background: color }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        editor.chain().focus().setColor(color).run();
                        setColorOpen(false);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="tool-group alignment-tools">
            {tool(
              "왼쪽 정렬",
              <AlignLeft size={18} />,
              () => {
                editor.chain().focus().setTextAlign("left").run();
              },
              editor.isActive({ textAlign: "left" }),
            )}
            {tool(
              "가운데 정렬",
              <AlignCenter size={18} />,
              () => {
                editor.chain().focus().setTextAlign("center").run();
              },
              editor.isActive({ textAlign: "center" }),
            )}
            {tool(
              "오른쪽 정렬",
              <AlignRight size={18} />,
              () => {
                editor.chain().focus().setTextAlign("right").run();
              },
              editor.isActive({ textAlign: "right" }),
            )}
          </div>
          <button
            type="button"
            className={`more-tools ${more ? "active" : ""}`}
            onClick={() => setMore(!more)}
            aria-expanded={more}
          >
            더 보기
            <ChevronDown size={13} />
          </button>
          <div className="tool-group history-tools">
            {tool(
              "실행 취소",
              <Undo2 size={18} />,
              () => {
                editor.chain().focus().undo().run();
              },
              false,
              !editor.can().undo(),
            )}
            {tool(
              "다시 실행",
              <Redo2 size={18} />,
              () => {
                editor.chain().focus().redo().run();
              },
              false,
              !editor.can().redo(),
            )}
          </div>
        </div>
      )}
      {!readOnly && more && (
        <div className="editor-toolbar extra-tools">
          <label className="line-height-select">
            줄간격
            <select
              aria-label="줄간격"
              value={
                editor.getAttributes(
                  editor.isActive("heading") ? "heading" : "paragraph",
                ).paragraphLineHeight || "1.6"
              }
              onChange={(e) => {
                editor
                  .chain()
                  .focus()
                  .updateAttributes(
                    editor.isActive("heading") ? "heading" : "paragraph",
                    { paragraphLineHeight: e.target.value },
                  )
                  .run();
              }}
            >
              {Array.from({ length: 25 }, (_, i) => 60 + i * 10).map(
                (value) => (
                  <option key={value} value={String(value / 100)}>
                    {value}%
                  </option>
                ),
              )}
            </select>
          </label>
          <div className="tool-group">
            {tool("들여쓰기", <IndentIncrease size={18} />, () => indent(1))}
            {tool("내어쓰기", <IndentDecrease size={18} />, () => indent(-1))}
          </div>
          <div className="tool-group">
            {tool(
              "글머리표",
              <List size={18} />,
              () => {
                editor.chain().focus().toggleBulletList().run();
              },
              editor.isActive("bulletList"),
            )}
            {tool(
              "번호 목록",
              <ListOrdered size={18} />,
              () => {
                editor.chain().focus().toggleOrderedList().run();
              },
              editor.isActive("orderedList"),
            )}
          </div>
          <button
            type="button"
            className="subtle-control"
            onClick={() => {
              editor.chain().focus().unsetAllMarks().clearNodes().run();
            }}
          >
            서식 지우기
          </button>
        </div>
      )}
      <div className="paper">
        <div className="paper-kicker">
          <span
            className={presenceLabel ? "teacher-presence" : ""}
            role="status"
          >
            {presenceLabel || "나의 이야기"}
          </span>
          <span>{doc.name}</span>
        </div>
        <label className="sr-only" htmlFor={`document-title-${doc.id}`}>
          글 제목
        </label>
        {readOnly ? (
          <h2 className="document-title-input">
            {doc.title || "제목 없는 글"}
          </h2>
        ) : (
          <>
            <input
              className="document-title-input"
              id={`document-title-${doc.id}`}
              value={composingTitle ?? doc.title}
              placeholder="제목을 적어 주세요"
              maxLength={DOCUMENT_TITLE_MAX_LENGTH}
              aria-describedby={`document-title-limit-${doc.id}`}
              aria-invalid={doc.title.length > DOCUMENT_TITLE_MAX_LENGTH}
              onCompositionStart={(e) => {
                titleComposing.current = true;
                setComposingTitle(e.currentTarget.value);
              }}
              onCompositionEnd={(e) => {
                titleComposing.current = false;
                setComposingTitle(null);
                onUpdate({
                  title: e.currentTarget.value.slice(0, DOCUMENT_TITLE_MAX_LENGTH),
                });
              }}
              onChange={(e) => {
                if (titleComposing.current) setComposingTitle(e.target.value);
                else onUpdate({
                  title: e.target.value.slice(0, DOCUMENT_TITLE_MAX_LENGTH),
                });
              }}
            />
            <div
              className={`document-title-limit${doc.title.length > DOCUMENT_TITLE_MAX_LENGTH ? " field-error" : ""}`}
              id={`document-title-limit-${doc.id}`}
            >
              {doc.title.length > DOCUMENT_TITLE_MAX_LENGTH
                ? `제목을 ${DOCUMENT_TITLE_MAX_LENGTH}자 이내로 줄여 주세요. `
                : ""}
              {(composingTitle ?? doc.title).length}/{DOCUMENT_TITLE_MAX_LENGTH}자
            </div>
          </>
        )}
        <div className="paper-rule" />
        <FeedbackSurface
          feedback={feedback}
          role={feedbackRole}
          onResponse={onFeedbackResponse}
        >
          <EditorContent editor={editor} />
        </FeedbackSurface>
      </div>
      {onCreateFeedback && selectionMenu && !pending && (
        <button
          type="button"
          className="selection-feedback-button"
          style={{ left: selectionMenu.left, top: selectionMenu.top }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            pendingRef.current = selectionMenu.range;
            setPending(selectionMenu.range);
            setSelectionMenu(null);
            setMessage("");
          }}
        >
          피드백 하기
        </button>
      )}
      {pending && (
        <form
          className="range-feedback-composer"
          onSubmit={(e) => {
            e.preventDefault();
            if (!message.trim() || !pendingRef.current) return;
            onCreateFeedback?.(message.trim(), pendingRef.current);
            pendingRef.current = null;
            setPending(null);
            setMessage("");
            setSelectionMenu(null);
          }}
        >
          <strong>선택한 부분에 피드백</strong>
          <blockquote>{pending.quote}</blockquote>
          <label className="field">
            선생님의 한마디
            <textarea
              autoFocus
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="이 구절에 대해 이야기해 주세요."
            />
          </label>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                pendingRef.current = null;
                setPending(null);
                setMessage("");
              }}
            >
              취소
            </button>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={!message.trim()}
            >
              피드백 남기기
            </button>
          </div>
        </form>
      )}
      <div className="editor-bottom">
        <span>
          <span className="mini-dot" />
          {readOnly ? "현재 원고" : (saveLabel ?? "작성 중")}
        </span>
        <span>{editor.getText().replace(/\s/g, "").length}자 · 공백 제외</span>
      </div>
    </div>
  );
}
