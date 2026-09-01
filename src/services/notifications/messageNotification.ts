import notifee, {
  AndroidImportance,
  AndroidStyle,
} from '@notifee/react-native';

import { decryptNotificationBody } from './decryptNotificationBody';

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

/** The page this message was addressed to, when the recipient manages one. */
export function notificationTargetPage(data: Record<string, string>): {
  id: string;
  name: string;
} | null {
  const id = pick(data, 'target_page_id', 'targetPageId');
  if (!id) return null;
  return { id, name: pick(data, 'target_page_name', 'targetPageName') };
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
  const senderAvatarUrl = pick(
    data,
    'sender_image',
    'senderImage',
    'avatarUrl',
    'avatar',
    'image',
    'profile_image',
  );
  const chatId = notificationChatId(data);

  /**
   * Group messages belong to the GROUP: the banner is titled by the group and
   * shows the group photo, with the sender named on the message line itself —
   * the same shape Messenger and WhatsApp use. Titling it by the sender left no
   * way to tell which group a message came from.
   */
  const isGroup = pick(data, 'is_group', 'isGroup', 'isGroupCall') === 'true';
  const groupName = pick(data, 'group_name', 'groupName');
  const groupPhoto = pick(data, 'group_photo', 'groupPhoto', 'groupPhotoUrl');

  /**
   * Notifee downloads `largeIcon` from a remote URL, but a missing/failed URL
   * leaves an empty circle. The launcher icon is a guaranteed local fallback so
   * every banner shows SOMETHING recognisable.
   */
  const DEFAULT_LARGE_ICON = 'ic_launcher';
  const avatarUrl = isGroup
    ? groupPhoto || senderAvatarUrl
    : senderAvatarUrl;
  const largeIcon = avatarUrl || DEFAULT_LARGE_ICON;

  const isDonationRequest = type === 'DONATION_REQUEST';
  // A message sent TO one of this user's pages is labelled with the page, so an
  // operator running several pages can tell which inbox it belongs to without
  // opening it — and so it does not read as a personal DM.
  const targetPage = notificationTargetPage(data);
  const baseTitle = isDonationRequest
    ? senderName || 'Donation Request'
    : senderName || 'New message';
  const title = isGroup
    ? groupName || 'Group message'
    : targetPage?.name && !isDonationRequest
      ? `${baseTitle} → ${targetPage.name}`
      : baseTitle;
  // Prefer text the DEVICE decrypted. The server can only ever send
  // "🔒 New message" for an encrypted chat, so without this the banner is
  // permanently useless — while WhatsApp/Telegram show the real message by
  // decrypting locally, which is exactly what this does.
  const decrypted = isDonationRequest ? null : decryptNotificationBody(data);

  const body = isDonationRequest
    ? pick(data, 'text', 'body', 'message', 'content') ||
      'Someone is interested in your request.'
    : decrypted ||
      pick(data, 'message_preview', 'body', 'message', 'content') ||
      'You have a new message';

  /**
   * When the message was sent.
   *
   * Android shows no time in the notification header unless BOTH `timestamp`
   * and `showTimestamp` are set — notifee's own docs: "If no timestamp is set,
   * this field has no effect." Neither was set, which is why every other app in
   * the shade showed a time and HopeChat showed none.
   *
   * Prefer the server's send time so a push that arrives late (device offline,
   * doze) is stamped when it was SENT rather than when it landed; fall back to
   * now when the payload carries no time.
   */
  const sentAtRaw = Number(
    pick(data, 'sentAt', 'sent_at', 'createdAt', 'created_at') || 0,
  );
  const sentAt =
    Number.isFinite(sentAtRaw) && sentAtRaw > 0 ? sentAtRaw : Date.now();

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
      timestamp: sentAt,
      showTimestamp: true,
      // Round avatar next to the message, like Messenger.
      // Without an explicit smallIcon Android falls back to the launcher icon and
      // flattens it to a silhouette — the empty ring beside HopeChat messages.
      smallIcon: 'ic_stat_notification',
      largeIcon,
      circularLargeIcon: true,
      // MESSAGING style renders it as a conversation with the sender.
      style: isDonationRequest
        ? undefined
        : {
            type: AndroidStyle.MESSAGING,
            // In Notifee's MessagingStyle the TOP-LEVEL person is the device
            // user, and the sender of each message goes on messages[].person.
            // These were the wrong way round: the sender was set as "self" and
            // the message itself had no person, so Android rendered it as sent
            // BY you — which is why the avatar circle came up empty while
            // WhatsApp/Messenger/Discord showed the photo.
            person: { name: 'You' },
            group: isGroup,
            title: isGroup ? groupName || undefined : undefined,
            messages: [
              {
                text: body,
                timestamp: sentAt,
                person: {
                  // The person on the message is always the SENDER — in a group
                  // the title is the group, so using it here would attribute
                  // every message to the group itself.
                  name: isGroup ? senderName || 'Someone' : title,
                  icon: (isGroup ? senderAvatarUrl : avatarUrl) || undefined,
                },
              },
            ],
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
