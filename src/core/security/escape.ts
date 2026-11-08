/**
 * Output escaping. React escapes text nodes automatically; everything that builds strings
 * for HTML (exported predictor pages, reports), CSV, or file names must go through here.
 * (Legacy app injected raw column names into innerHTML — fixed by construction.)
 */
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
};

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"'`]/g, (c) => HTML_ESCAPES[c]);
}

/** Safe for use inside a quoted HTML attribute. */
export const escapeAttr = escapeHtml;

/** Escape a string for embedding inside a <script> JSON literal. */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Turn arbitrary text into a safe file name (keeps CJK). */
export function safeFileName(name: string, fallback = 'file'): string {
  const cleaned = name
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex -- stripping control characters is the point
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
}
