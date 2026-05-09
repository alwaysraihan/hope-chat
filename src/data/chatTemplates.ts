import { Dimensions } from 'react-native';
import { ExtendedMessage } from '../components/types/chat';

const SUPPORT_USER = { _id: 'support', name: 'Raihan Sarkar' };
export const CHAT_TEMPLATE_ME = { _id: '1', name: 'You' };

const now = Date.now();
const t = (offsetMinutes: number) => new Date(now - offsetMinutes * 60_000);
export const { width: CHAT_SCREEN_WIDTH } = Dimensions.get('window');

export const DEFAULT_MESSAGES: ExtendedMessage[] = [
  {
    _id: 'old-1',
    text: 'Hey! Welcome to support 👋',
    createdAt: t(60 * 24 + 30),
    user: SUPPORT_USER,
  },
  {
    _id: 'old-2',
    text: 'Hi! I need help with my recent order.',
    createdAt: t(60 * 24 + 25),
    user: CHAT_TEMPLATE_ME,
  },
  {
    _id: 'old-3',
    text: 'Sure, could you share your order number?',
    createdAt: t(60 * 24 + 20),
    user: SUPPORT_USER,
  },
  {
    _id: 'txt-1',
    text: 'Good morning! Just following up on our earlier chat.',
    createdAt: t(55),
    user: SUPPORT_USER,
  },
  {
    _id: 'txt-2',
    text: 'Good morning! Yes, my order #ORD-20489 still shows "Processing".',
    createdAt: t(53),
    user: CHAT_TEMPLATE_ME,
  },
  {
    _id: 'reply-1',
    text: "I checked and it's been dispatched — should arrive by tomorrow.",
    createdAt: t(50),
    user: SUPPORT_USER,
    replyTo: {
      _id: 'txt-2',
      text: 'Good morning! Yes, my order #ORD-20489 still shows "Processing".',
      user: CHAT_TEMPLATE_ME,
    },
  },
  {
    _id: 'react-1',
    text: 'That is great news, thank you so much! 🙏',
    createdAt: t(48),
    user: CHAT_TEMPLATE_ME,
    reactions: [
      { emoji: '❤️', userId: 'support', userName: 'Support' },
      { emoji: '👍', userId: 'support', userName: 'Support' },
    ],
  },
  {
    _id: 'img-1',
    text: '',
    createdAt: t(40),
    user: SUPPORT_USER,
    media: {
      type: 'image',
      url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600',
      remoteUri:
        'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600',
    },
  },
  {
    _id: 'img-caption',
    text: 'Here is a photo of the item you ordered.',
    createdAt: t(39),
    user: SUPPORT_USER,
  },
  {
    _id: 'img-2',
    text: '',
    createdAt: t(35),
    user: CHAT_TEMPLATE_ME,
    media: {
      type: 'image',
      url: 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=600',
      remoteUri:
        'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=600',
    },
  },
  {
    _id: 'vid-1',
    text: '',
    createdAt: t(30),
    user: SUPPORT_USER,
    media: {
      type: 'video',
      url: 'https://www.w3schools.com/html/mov_bbb.mp4',
      remoteUri: 'https://www.w3schools.com/html/mov_bbb.mp4',
      thumbnail:
        'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=400',
    },
  },
  {
    _id: 'voice-1',
    text: '',
    createdAt: t(22),
    user: SUPPORT_USER,
    media: {
      type: 'voice',
      remoteUri:
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      duration: 18,
    },
  },
  {
    _id: 'voice-2',
    text: '',
    createdAt: t(18),
    user: CHAT_TEMPLATE_ME,
    media: {
      type: 'voice',
      remoteUri:
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      duration: 9,
    },
    replyTo: {
      _id: 'voice-1',
      text: '',
      media: {
        type: 'voice',
        remoteUri:
          'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        duration: 18,
      },
      user: SUPPORT_USER,
    },
  },
  {
    _id: 'img-reply-1',
    text: 'Is this the correct size guide?',
    createdAt: t(12),
    user: CHAT_TEMPLATE_ME,
    replyTo: {
      _id: 'img-1',
      text: '',
      media: {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600',
      },
      user: SUPPORT_USER,
    },
  },
  {
    _id: 'long-1',
    text:
      "Yes, that's the correct size guide. Our products run true to size, but if you're between sizes we always recommend going up.",
    createdAt: t(10),
    user: SUPPORT_USER,
    reactions: [{ emoji: '😊', userId: '1', userName: 'You' }],
  },
  {
    _id: 'latest-1',
    text: 'Perfect, I will go with size M then. Thanks!',
    createdAt: t(1),
    user: CHAT_TEMPLATE_ME,
    pending: false,
  },
];

export function remapDefaultMessagesForPeer(
  peerId: string,
  peerName: string,
  localUser: { _id: string | number; name: string },
): ExtendedMessage[] {
  const peer = { _id: peerId, name: peerName };
  const localIdStr = String(localUser._id);
  const mapUser = (
    u: { _id: string | number; name?: string } | undefined,
  ) => {
    if (!u) return peer;
    if (String(u._id) === 'support') return peer;
    return { _id: localUser._id, name: localUser.name };
  };

  const mapReplyTo = (
    r:
      | {
          _id?: string | number;
          text?: string;
          media?: ExtendedMessage['media'];
          user?: { _id: string | number; name?: string };
        }
      | undefined,
  ) => {
    if (!r) return undefined;
    return {
      _id: `${peerId}_${r._id}`,
      text: r.text,
      media: r.media,
      user: mapUser(r.user),
    };
  };

  return DEFAULT_MESSAGES.map(m => ({
    ...m,
    _id: `${peerId}_${m._id}`,
    user: mapUser(m.user),
    reactions: (m.reactions ?? []).map(rc => ({
      emoji: rc.emoji,
      userId:
        rc.userId === 'support' ? peerId : rc.userId === '1' ? localIdStr : rc.userId,
      userName:
        rc.userId === 'support'
          ? peerName
          : rc.userId === '1'
            ? localUser.name
            : rc.userName ?? 'Peer',
    })),
    replyTo: mapReplyTo(m.replyTo),
  }));
}
