import DOMPurify from "dompurify";
export const safeHtml = (html: string) =>
  DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "span",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
      "hr",
    ],
    ALLOWED_ATTR: ["style", "start"],
  });
export const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

// Match ProseMirror's visible trailing line in static readers.
export const documentHtml = (html: string) =>
  safeHtml(html).replace(/(<br>)(<\/(?:p|h[1-6])>)/g, "$1<br>$2");
