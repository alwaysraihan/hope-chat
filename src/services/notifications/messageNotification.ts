import notifee, {
  AndroidImportance,
  AndroidStyle,
} from '@notifee/react-native';

export const MESSAGE_CHANNEL_ID = 'hopechat_messages_v1';

/**
 * FCM data.type values that are allowed to produce a push notification.
 * Calls are handled separately via the call-notification path.
 * FRIEND_REQUEST / FRIEND_REQUEST_ACCEPTED belong to Hopenity — only Hopenity
 * shows those banners. Every other social type (POST_LIKE, COMMENT, etc.) is
 * silently dropped here too.
 */
export const ALLOWED_PUSH_TYPES = new Set(['MESSAGE', 'DONATION_REQUEST']);

export async function ensureMessagesChannel(): Promise<void> {
  await notifee.createChannel({
    id: MESSAGE_CHANNEL_ID,
    name: 'Messages & Requests',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });
}

function pick(data: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = data[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

/** The chat this notification belongs to, if the payload names one. */
export function notificationChatId(data: Record<string, string>): string {
  return pick(data, 'chatId', 'chat_id', 'conversationId');
}

/**
 * Messenger-style chat banner: the sender's Hopenity name as the title, their
 * profile photo as the avatar, and the start of the message as the body.
 * Messages from the same chat stack into one conversation thread.
 */
export async function displayMessagingNotification(
  data: Record<string, string>,
): Promise<void> {
  const type = (data.type ?? '').toUpperCase();
  if (!ALLOWED_PUSH_TYPES.has(type)) return;

  const senderName = pick(
    data,
    'sender_name',
    'senderName',
    'name',
    'displayName',
    'callerName',
  );
  const avatarUrl = pick(
    data,
    'sender_image',
    'senderImage',
    'avatarUrl',
    'avatar',
    'image',
    'profile_image',
  );
  const chatId = notificationChatId(data);

  const isDonationRequest = type === 'DONATION_REQUEST';
  const title = isDonationRequest
    ? senderName || 'Donation Request'
    : senderName || 'New message';
  const body = isDonationRequest
    ? pick(data, 'text', 'body', 'message', 'content') ||
      'Someone is interested in your request.'
    : pick(data, 'message_preview', 'body', 'message', 'content') ||
      'You have a new message';

  await ensureMessagesChannel();
  await notifee.displayNotification({
    // One notification per chat, so a burst of messages updates the same banner
    // instead of stacking a dozen of them.
    id: chatId ? `msg_${chatId}` : undefined,
    title,
    body,
    data,
    android: {
      channelId: MESSAGE_CHANNEL_ID,
      importance: AndroidImportance.HIGH,
      // Round avatar next to the message, like Messenger.
      largeIcon: avatarUrl || undefined,
      circularLargeIcon: true,
      // MESSAGING style renders it as a conversation with the sender.
      style: isDonationRequest
        ? undefined
        : {
            type: AndroidStyle.MESSAGING,
            person: {
              name: title,
              icon: avatarUrl || undefined,
            },
            messages: [{ text: body, timestamp: Date.now() }],
          },
      groupId: chatId ? `chat_${chatId}` : undefined,
      pressAction: { id: 'default', launchActivity: 'default' },
    },
    ios: {
      attachments: avatarUrl ? [{ url: avatarUrl }] : undefined,
      threadId: chatId ? `chat_${chatId}` : undefined,
    },
  });
}
