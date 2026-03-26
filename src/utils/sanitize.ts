import DOMPurify from "dompurify";

// Allowlisted tags for email HTML rendering
const ALLOWED_TAGS = [
  "a", "abbr", "address", "article", "aside",
  "b", "bdi", "bdo", "blockquote", "br",
  "caption", "center", "cite", "code", "col", "colgroup",
  "dd", "del", "details", "dfn", "div", "dl", "dt",
  "em",
  "figcaption", "figure", "font", "footer",
  "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hr", "html",
  "i", "img", "ins",
  "kbd",
  "li",
  "main", "map", "mark", "meta",
  "nav",
  "ol",
  "p", "pre",
  "q",
  "rp", "rt", "ruby",
  "s", "samp", "section", "small", "span", "strong", "style", "sub", "summary", "sup",
  "table", "tbody", "td", "tfoot", "th", "thead", "title", "tr", "tt",
  "u", "ul",
  "var",
  "wbr",
];

const ALLOWED_ATTR = [
  "align", "alt", "bgcolor", "border", "cellpadding", "cellspacing",
  "class", "color", "colspan", "dir", "face",
  "height", "href", "hspace",
  "id", "lang",
  "name",
  "rowspan",
  "size", "src", "style", "summary",
  "target", "title", "type",
  "valign", "vspace",
  "width",
];

const FORBID_TAGS = [
  "script", "iframe", "object", "embed", "form", "input",
  "textarea", "select", "button", "applet", "link",
];

const FORBID_ATTR = [
  "onerror", "onclick", "onload", "onmouseover", "onmouseout",
  "onfocus", "onblur", "onsubmit", "onkeydown", "onkeyup",
  "onkeypress", "onchange", "oninput", "oncontextmenu",
  "ondblclick", "ondrag", "ondragend", "ondragenter",
  "ondragleave", "ondragover", "ondragstart", "ondrop",
];

/**
 * Sanitize HTML email content for safe rendering in an iframe.
 * Strips scripts, forms, event handlers, and other dangerous elements.
 */
export function sanitizeEmailHtml(html: string): string {
  // Force all links to open in new tab
  const withBaseTarget = `<base target="_blank" />${html}`;

  const clean = DOMPurify.sanitize(withBaseTarget, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS,
    FORBID_ATTR,
    WHOLE_DOCUMENT: true,
    ADD_ATTR: ["target"],
  });

  return clean;
}

/**
 * Strip all HTML and return plain text.
 */
export function htmlToPlainText(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = DOMPurify.sanitize(html, { ALLOWED_TAGS: [] });
  return div.textContent || "";
}
