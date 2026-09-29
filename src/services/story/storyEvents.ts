import { DeviceEventEmitter } from 'react-native';
import { createMMKV, type MMKV } from 'react-native-mmkv';
import type { StoryRing } from '../../data/storyFeedCache';

/**
 * HomeScreen.tsx, StoryScreen.tsx, and StoryViewerScreen.tsx each keep their
 * own independent copy of the story feed (fetched on mount/focus) — there is
 * no shared store. Deleting a story from the viewer only updated its own
 * local cache, so the other two screens kept showing the deleted story until
 * their next natural refetch (which itself has a gap: an empty refetch
 * result is treated as a failure and the stale state is kept). This event
 * lets every mounted screen remove the story immediately instead of relying
 * on that.
 */
export const STORY_DELETED_EVENT = 'hopechat:story_deleted_v1';

/**
 * The backend itself is inconsistent right after a delete: `/stories/:id`
 * lookups correctly 404, but the `/stories` feed *listing* can keep serving
 * the deleted story for a while (confirmed live — a stale index/cache on
 * their end, not something the client can fix). Remembering deleted ids
 * locally and filtering every future feed fetch against them keeps that
 * backend lag from leaking back into the UI after a fresh fetch.
 */
let _store: MMKV | null = null;
function store(): MMKV {
  if (!_store) _store = createMMKV({ id: 'hopechat-deleted-stories-v1' });
  return _store;
}

const K_DELETED = 'deleted_story_ids';
/** Story ids are recycled/reused rarely enough that a generous TTL is safe. */
const DELETED_MAX_AGE_MS = 7 * 24 * 60 * 60_000;

type DeletedRecord = Record<string, number>; // storyId -> deletedAtMs

function readDeleted(): DeletedRecord {
  try {
    const raw = store().getString(K_DELETED);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DeletedRecord;
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function pruneAndWrite(rec: DeletedRecord): void {
  const cutoff = Date.now() - DELETED_MAX_AGE_MS;
  const pruned: DeletedRecord = {};
  for (const [id, at] of Object.entries(rec)) {
    if (at >= cutoff) pruned[id] = at;
  }
  try {
    store().set(K_DELETED, JSON.stringify(pruned));
  } catch {
    /* best-effort */
  }
}

export function markStoryDeletedLocally(storyId: string): void {
  if (!storyId) return;
  const rec = readDeleted();
  rec[storyId] = Date.now();
  pruneAndWrite(rec);
}

export function isStoryDeletedLocally(storyId: string): boolean {
  if (!storyId) return false;
  return storyId in readDeleted();
}

export function emitStoryDeleted(storyId: string): void {
  markStoryDeletedLocally(storyId);
  DeviceEventEmitter.emit(STORY_DELETED_EVENT, { storyId });
}

/**
 * Fired right after a successful upload, carrying a ring built from data we
 * already have locally (no need to wait on the feed listing endpoint, which
 * — like the delete path — can lag behind a fresh write by a few seconds).
 * HomeScreen.tsx / StoryScreen.tsx merge this straight into their own state
 * so the new story appears immediately instead of waiting for their next
 * natural refetch to happen to already reflect it.
 */
export const STORY_POSTED_EVENT = 'hopechat:story_posted_v1';

export function emitStoryPosted(ring: StoryRing): void {
  DeviceEventEmitter.emit(STORY_POSTED_EVENT, { ring });
}
