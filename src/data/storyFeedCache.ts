/** In-memory payload for StoryViewer navigation (avoid huge route params). */
export type StorySlide = {
  id: string;
  uri: string;
  durationMs: number;
  /** 'video' when the URI points to a video file; defaults to 'image'. */
  type?: 'image' | 'video';
  /** Poster image for video slides — used for grid covers, where `uri` is unrenderable. */
  thumbUri?: string | null;
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
};

let cachedRings: StoryRing[] = [];

export function setStoryFeedRings(next: StoryRing[]): void {
  cachedRings = next;
}

export function getStoryFeedRings(): StoryRing[] {
  return cachedRings;
}
