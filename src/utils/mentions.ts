/**
 * @mentions in group chats. A picked name is inserted with non-breaking spaces
 * ("@Raihan Sarkar") so the whole name stays one token: the bubble can
 * highlight it without knowing the member list, and it still reads normally.
 */

const NBSP = ' ';

/** `@` + everything up to a real space/newline/next `@` (NBSP is part of the name). */
export const MENTION_RE = /@[^ \t\r\n@]+/g;

/** The `@query` being typed at the end of the text, or null. */
export function activeMentionQuery(text: string): string | null {
  const m = /(^|[ \t\r\n])@([^ \t\r\n@]*)$/.exec(text);
  return m ? m[2]!.replace(new RegExp(NBSP, 'g'), ' ') : null;
}

/** Replace the trailing `@query` with the picked member's name. */
export function insertMention(text: string, name: string): string {
  const token = `@${name.trim().replace(/\s+/g, NBSP)} `;
  return text.replace(/@([^ \t\r\n@]*)$/, token);
}

export function splitMentions(text: string): Array<{ text: string; mention: boolean }> {
  const out: Array<{ text: string; mention: boolean }> = [];
  let last = 0;
  for (const m of text.matchAll(MENTION_RE)) {
    const start = m.index ?? 0;
    // Only at a word boundary — "mail@example.com" is not a mention.
    if (start > 0 && !/[ \t\r\n(]/.test(text[start - 1]!)) continue;
    if (start > last) out.push({ text: text.slice(last, start), mention: false });
    out.push({ text: m[0], mention: true });
    last = start + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), mention: false });
  return out;
}
