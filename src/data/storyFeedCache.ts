/** In-memory payload for StoryViewer navigation (avoid huge route params). */
export type StorySlide = {
  id: string;
  /** Empty for a 'text' slide — it has no media, just `text` + `backgroundColor`. */
  uri: string;
  durationMs: number;
  /** 'video'/'image' point to `uri`; 'text' renders `text` on `backgroundColor` instead. */
  type?: 'image' | 'video' | 'text';
  /** Poster image for video slides — used for grid covers, where `uri` is unrenderable. */
  thumbUri?: string | null;
  /** ISO timestamp from the backend — a story past this is no longer viewable. */
  expiresAt?: string | null;
  /** Content for a 'text' slide. */
  text?: string | null;
  backgroundColor?: string | null;
};

export type StoryRing = {
  id: string;
  name: string;
  avatarUri?: string | null;
  slides: StorySlide[];
  /** True when the ring belongs to a Page rather than a personal account. */
  isPage?: boolean;
  /** Numeric/DB id of the author (page id for pages, user id otherwise). */
  authorId?: string;
  /** Public id of the author (page_id for pages, user_id otherwise). */
  authorPublicId?: string;
  isVerified?: boolean;
};

let cachedRings: StoryRing[] = [];

export function setStoryFeedRings(next: StoryRing[]): void {
  cachedRings = next;
}

export function getStoryFeedRings(): StoryRing[] {
  return cachedRings;
}
