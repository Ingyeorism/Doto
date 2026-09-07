import { Extension, getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
export const ParagraphIndent = Extension.create({
  name: "paragraphIndent",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (e) => Number.parseInt(e.style.marginLeft) / 24 || 0,
            renderHTML: (a) =>
              a.indent
                ? {
                    style: `margin-left: ${Math.min(6, Math.max(0, a.indent)) * 24}px`,
                  }
                : {},
          },
          paragraphLineHeight: {
            default: null,
            parseHTML: (e) => e.style.lineHeight || null,
            renderHTML: (a) =>
              a.paragraphLineHeight
                ? { style: `line-height: ${a.paragraphLineHeight}` }
                : {},
          },
        },
      },
    ];
  },
});
export const baseExtensions = () => [
  StarterKit.configure({ link: false, undoRedo: false }),
  TextStyleKit.configure({ lineHeight: false }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  ParagraphIndent,
];
export const writingSchema = getSchema(baseExtensions());
