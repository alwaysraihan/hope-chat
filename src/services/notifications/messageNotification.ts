import notifee, {
  AndroidImportance,
  AndroidStyle,
} from '@notifee/react-native';

import { decryptNotificationBody } from './decryptNotificationBody';

export const MESSAGE_CHANNEL_ID = 'hopechat_messages_v1';

/**
 * ONE group for every chat notification, plus a summary row — the WhatsApp
 * shade layout ("2 messages from 2 chats", expandable into one row per chat).
 *
 * Each chat previously had its OWN groupId, so Android never had a group to
 * summarise: notifications stacked as unrelated banners with no roll-up.
 */
const MESSAGE_GROUP_ID = 'hopechat_messages';
const SUMMARY_NOTIFICATION_ID = 'hopechat_messages_summary';

/** How many past lines a single chat's expanded notification keeps. */
const MAX_HISTORY = 6;

type HistoryLine = { text: string; timestamp: number; senderName: string; senderIcon?: string };

/**
 * Previous lines for this chat, read back off the notification already in the
 * shade. Android keeps our `data` payload, so the thread's history survives
 * without any storage of our own.
 */
async function readHistory(notificationId: string): Promise<HistoryLine[]> {
  try {
    const displayed = await notifee.getDisplayedNotifications();
    const existing = displayed.find(n => n.id === notificationId);
    const raw = (existing?.notification?.data as Record<string, string> | undefined)?.history;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryLine[]) : [];
  } catch {
    return [];
  }
}

/**
 * Roll-up row shown above the individual chats. Android requires a group
 * summary before it will collapse a group; without one each chat sits loose in
 * the shade.
 */
async function refreshSummary(): Promise<void> {
  try {
    const displayed = await notifee.getDisplayedNotifications();
    const chats = displayed.filter(
      n =>
        n.notification?.android?.channelId === MESSAGE_CHANNEL_ID &&
        n.id !== SUMMARY_NOTIFICATION_ID,
    );
    if (chats.length === 0) {
      await notifee.cancelNotification(SUMMARY_NOTIFICATION_ID);
      return;
    }

    let messageCount = 0;
    for (const n of chats) {
      const raw = (n.notification?.data as Record<string, string> | undefined)?.history;
      try {
        const parsed = raw ? JSON.parse(raw) : null;
        messageCount += Array.isArray(parsed) ? parsed.length : 1;
      } catch {
        messageCount += 1;
      }
    }

    // A single chat needs no roll-up — WhatsApp shows the chat alone too.
    if (chats.length < 2) {
      await notifee.cancelNotification(SUMMARY_NOTIFICATION_ID);
      return;
    }

    await notifee.displayNotification({
      id: SUMMARY_NOTIFICATION_ID,
      title: 'HopeChat',
      body: `${messageCount} message${messageCount === 1 ? '' : 's'} from ${chats.length} chats`,
      android: {
        channelId: MESSAGE_CHANNEL_ID,
        smallIcon: 'ic_stat_notification',
        groupId: MESSAGE_GROUP_ID,
        groupSummary: true,
        pressAction: { id: 'default', launchActivity: 'default' },
      },
    });
  } catch {
    /* the individual notifications are what matter — a missing summary is cosmetic */
  }
}

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

  const notificationId = chatId ? `msg_${chatId}` : `msg_${Date.now()}`;

  // Append to whatever this chat already shows, so an expanded notification
  // reads as a conversation instead of replacing the previous line.
  const previous = isDonationRequest ? [] : await readHistory(notificationId);
  const history: HistoryLine[] = [
    ...previous,
    {
      text: body,
      timestamp: sentAt,
      senderName: isGroup ? senderName || 'Someone' : title,
      senderIcon: (isGroup ? senderAvatarUrl : avatarUrl) || undefined,
    },
  ].slice(-MAX_HISTORY);

  await ensureMessagesChannel();
  await notifee.displayNotification({
    // One notification per chat, so a burst of messages updates the same banner
    // instead of stacking a dozen of them.
    id: notificationId,
    title,
    body,
    data: { ...data, history: JSON.stringify(history) },
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
            messages: history.map(line => ({
              text: line.text,
              timestamp: line.timestamp,
              person: {
                // The person on a message is always the SENDER — in a group the
                // title is the group, so using it here would attribute every
                // message to the group itself.
                name: line.senderName,
                icon: line.senderIcon,
              },
            })),
          },
      groupId: MESSAGE_GROUP_ID,
      pressAction: { id: 'default', launchActivity: 'default' },
    },
    ios: {
      attachments: avatarUrl ? [{ url: avatarUrl }] : undefined,
      threadId: chatId ? `chat_${chatId}` : undefined,
      // iOS rolls its own summary up from the thread id.
      summaryArgument: isGroup ? groupName || senderName : senderName,
    },
  });

  await refreshSummary();
}

/**
 * Drop a chat's notification (and refresh the roll-up) — called when the user
 * opens that conversation, so the shade matches what they have actually read.
 */
export async function clearChatNotification(chatId: string): Promise<void> {
  if (!chatId) return;
  try {
    await notifee.cancelNotification(`msg_${chatId}`);
    await refreshSummary();
  } catch {
    /* best-effort */
  }
}
