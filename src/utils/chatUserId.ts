/**
 * Gifted Chat compares `message.user._id` to `user._id` with strict equality.
 * API payloads may use numbers vs strings; normalize so bubbles left/right match.
 */
export function normalizeChatUserId(id: unknown): string {
  if (id === null || id === undefined) return '';
  return String(id).trim();
}
