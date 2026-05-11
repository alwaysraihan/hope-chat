import type { ConversationSummary } from '../../context/ChatsContext';

/** 1:1 chats that can appear on story-style strips (not groups, not incoming request). */
export function isDmEligibleForStoryStrips(c: ConversationSummary): boolean {
  if (c.isGroup) return false;
  if (c.needsAcceptance) return false;
  return true;
}

/**
 * True when the server (or nested peer profile) signals an active / countable story.
 * If nothing is sent, returns false so inactive peers without stories are not listed.
 */
export function conversationHasStoryRing(c: ConversationSummary): boolean {
  if (!isDmEligibleForStoryStrips(c)) return false;
  const u = c.unviewedStoryCount ?? 0;
  if (u > 0) return true;
  const n = c.peerStoryCount ?? 0;
  if (n > 0) return true;
  if (c.peerHasActiveStory === true) return true;
  return false;
}
