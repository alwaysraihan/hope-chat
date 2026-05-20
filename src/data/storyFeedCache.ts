/** In-memory payload for StoryViewer navigation (avoid huge route params). */
export type StorySlide = {
  id: string;
  uri: string;
  durationMs: number;
  /** 'video' when the URI points to a video file; defaults to 'image'. */
  type?: 'image' | 'video';
};

export type StoryRing = {
  id: string;
  name: string;
  avatarUri?: string | null;
  slides: StorySlide[];
};

let cachedRings: StoryRing[] = [];

export function setStoryFeedRings(next: StoryRing[]): void {
  cachedRings = next;
}

export function getStoryFeedRings(): StoryRing[] {
  return cachedRings;
}
