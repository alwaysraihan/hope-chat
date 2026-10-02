import {
  DELETED_TEXT,
  isServerEchoOfPending,
  mergeFetchedAsc,
  mergeIntroDesc,
} from '../src/utils/messageMerge';
import type { ExtendedMessage } from '../src/components/types/chat';

const msg = (o: Partial<ExtendedMessage> & { _id: string }): ExtendedMessage =>
  ({
    text: 'hi',
    createdAt: new Date('2026-01-01T10:00:00Z'),
    user: { _id: 'u1' },
    ...o,
  }) as ExtendedMessage;

describe('mergeFetchedAsc', () => {
  it('returns null when nothing changed', () => {
    const a = [msg({ _id: '1' })];
    expect(mergeFetchedAsc(a, [msg({ _id: '1' })])).toBeNull();
  });

  it("applies the peer's edit to a row already on screen", () => {
    const prev = [msg({ _id: '1', text: 'old' })];
    const out = mergeFetchedAsc(prev, [msg({ _id: '1', text: 'new', editedAt: '2026-01-01T10:05:00Z' })]);
    expect(out?.[0]?.text).toBe('new');
    expect(out?.[0]?.editedAt).toBe('2026-01-01T10:05:00Z');
  });

  it('never overwrites plaintext with the decrypting placeholder', () => {
    const prev = [msg({ _id: '1', text: 'secret' })];
    const out = mergeFetchedAsc(prev, [msg({ _id: '1', text: '🔒 Decrypting…', editedAt: 'x' })]);
    expect(out).toBeNull();
  });

  it('turns a server-deleted row into a tombstone and drops its reactions', () => {
    const prev = [msg({ _id: '1', reactions: [{ emoji: '👍', userId: 'u2', userName: 'B' }] })];
    const out = mergeFetchedAsc(prev, [msg({ _id: '1', deleted: true })]);
    expect(out?.[0]).toMatchObject({ deleted: true, text: DELETED_TEXT, reactions: [] });
  });

  it("syncs someone else's reaction", () => {
    const prev = [msg({ _id: '1' })];
    const out = mergeFetchedAsc(prev, [
      msg({ _id: '1', reactions: [{ emoji: '❤️', userId: 'u2', userName: 'B' }] }),
    ]);
    expect(out?.[0]?.reactions).toHaveLength(1);
  });

  it('leaves pending bubbles alone and replaces them with their server echo', () => {
    const pending = msg({ _id: 'local', text: 'yo', pending: true });
    const out = mergeFetchedAsc([pending], [msg({ _id: '77', text: 'yo' })]);
    expect(out).toHaveLength(1);
    expect(out?.[0]?._id).toBe('77');
  });

  it('appends genuinely new messages in time order', () => {
    const prev = [msg({ _id: '1' })];
    const later = msg({ _id: '2', text: 'later', createdAt: new Date('2026-01-01T11:00:00Z') });
    expect(mergeFetchedAsc(prev, [later])?.map(m => m._id)).toEqual(['1', '2']);
  });
});

describe('isServerEchoOfPending', () => {
  it('requires same sender and text within the window', () => {
    const p = msg({ _id: 'l', text: 'a', pending: true });
    expect(isServerEchoOfPending(p, msg({ _id: '9', text: 'a' }))).toBe(true);
    expect(isServerEchoOfPending(p, msg({ _id: '9', text: 'b' }))).toBe(false);
    expect(isServerEchoOfPending(p, msg({ _id: '9', text: 'a', user: { _id: 'u2' } }))).toBe(false);
  });
});

describe('mergeIntroDesc', () => {
  it('adds no intro card without a peer', () => {
    expect(mergeIntroDesc([msg({ _id: '1' })])).toHaveLength(1);
  });
});
