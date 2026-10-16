import {
  formatChatListPreview,
  mapApiMessageToTimeline,
  normalizeHopenityWireContent,
} from '../src/services/chatMessagePreview';

const post =
  '__hopechat_post__:{"postId":"745398","postDetails":"Cotton set.\\n\\nPrice : 1080 TK","imageUrl":"https://cdn.hopenity.com/photos/a.webp","authorName":"MD EMON","authorUserId":"cmodp2oop000001spfvsk8ikm"}';

describe('Hopenity wire formats', () => {
  it('turns a shared post into its post link', () => {
    expect(mapApiMessageToTimeline({ content: post }).text).toBe(
      'https://hopenity.com/post/745398',
    );
  });

  it('shows a label, not JSON, in the chat list', () => {
    expect(formatChatListPreview({ content: post, senderId: 'peer' }, 'me')).toBe(
      '📝 Shared a post',
    );
    expect(formatChatListPreview({ content: post, senderId: 'me' }, 'me')).toBe(
      'You: 📝 Shared a post',
    );
  });

  it('unwraps media payloads to their URL', () => {
    expect(
      normalizeHopenityWireContent(
        '__hopechat_media__:{"kind":"image","url":"https://cdn.hopenity.com/x.jpg"}',
      ),
    ).toBe('https://cdn.hopenity.com/x.jpg');
  });

  it('leaves ordinary and malformed text alone', () => {
    expect(normalizeHopenityWireContent('hello')).toBe('hello');
    expect(normalizeHopenityWireContent('__hopechat_post__:{bad')).toBe('__hopechat_post__:{bad');
  });
});
