import type { ConversationSummary } from '../../context/ChatsContext';
import type { StoryRing } from '../../data/storyFeedCache';
import { conversationHasStoryRing } from './storyStripEligibility';

const slide = (
  cid: string,
  suffix: string,
  ms: number,
): { id: string; uri: string; durationMs: number } => ({
  id: `${cid}_${suffix}`,
  uri: `https://picsum.photos/seed/hc${cid}${suffix}/1080/1920`,
  durationMs: ms,
});

export function storyRingsFromConversations(
  conversations: ConversationSummary[],
): StoryRing[] {
  const withStories = conversations.filter(conversationHasStoryRing);
  return withStories.slice(0, 14).map(c => ({
    id: c.id,
    name: (c.name || 'Friend').trim().split(/\s+/)[0] || 'Friend',
    avatarUri: c.avatarUrl,
    slides: [
      slide(c.id, 'a', 5300),
      slide(c.id, 'b', 4800),
    ],
  }));
}

/** Tab “Stories” grid — same aesthetic with static-friendly rows. */
export function storyTilesFromRings(rings: StoryRing[]): StoryRing[] {
  return rings;
}
