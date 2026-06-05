import notifee, { AndroidImportance, TriggerType } from '@notifee/react-native';
import type { TimestampTrigger } from '@notifee/react-native';

const CHANNEL_ID = 'booking-reminders';

async function ensureChannel() {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Booking Reminders',
    importance: AndroidImportance.HIGH,
  });
}

// ─── Booking card message ─────────────────────────────────────────────────────

export function formatBookingCardMessage(params: {
  bookingId: number;
  isHopeWish: boolean;
  scheduledAt: string;
  durationMinutes: number;
  totalAmount: number;
  peerName: string;
}): string {
  const { bookingId, isHopeWish, scheduledAt, durationMinutes, totalAmount, peerName } = params;

  const dateStr = new Date(scheduledAt).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
  const timeStr = new Date(scheduledAt).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

  if (isHopeWish) {
    return [
      '🌟 HOPE WISH CONFIRMED',
      '',
      `Creator: ${peerName}`,
      `📅 Deliver by: ${dateStr}`,
      `💰 Paid: $${totalAmount.toFixed(2)}`,
      '',
      `Booking #${bookingId} · Status: PENDING`,
      '',
      'The creator will record your personalised video and deliver it by the date above.',
    ].join('\n');
  }

  return [
    '📞 CALL BOOKING CONFIRMED',
    '',
    `With: ${peerName}`,
    `📅 Date: ${dateStr}`,
    `🕐 Time: ${timeStr}`,
    `⏱ Duration: ${durationMinutes} min`,
    `💰 Amount: $${totalAmount.toFixed(2)}`,
    '',
    `Booking #${bookingId} · Status: PENDING`,
    '',
    "You'll receive reminders at 24 h, 1 h, and 15 min before the call.",
  ].join('\n');
}

// ─── Pre-meeting notifications ────────────────────────────────────────────────

export async function scheduleBookingNotifications(params: {
  bookingId: number;
  isHopeWish: boolean;
  scheduledAt: string;
  durationMinutes: number;
  peerName: string;
}): Promise<void> {
  const { bookingId, isHopeWish, scheduledAt, peerName } = params;
  try {
    await ensureChannel();
    const meetingMs = new Date(scheduledAt).getTime();
    const now = Date.now();

    if (isHopeWish) {
      // Single reminder 24 h before delivery deadline
      const fireMs = meetingMs - 24 * 60 * 60 * 1000;
      if (fireMs > now) {
        const trigger: TimestampTrigger = { type: TriggerType.TIMESTAMP, timestamp: fireMs };
        await notifee.createTriggerNotification(
          {
            id: `hope-wish-${bookingId}`,
            title: '🌟 Hope Wish Reminder',
            body: `Your Hope Wish for ${peerName} is due tomorrow.`,
            android: { channelId: CHANNEL_ID, smallIcon: 'ic_launcher', pressAction: { id: 'default' } },
          },
          trigger,
        );
      }
      return;
    }

    // Call: 24 h, 1 h, 15 min reminders
    const reminders = [
      {
        ms: 24 * 60 * 60 * 1000,
        id: `booking-24h-${bookingId}`,
        body: `Your call with ${peerName} is tomorrow. Get ready!`,
      },
      {
        ms: 60 * 60 * 1000,
        id: `booking-1h-${bookingId}`,
        body: `Your call with ${peerName} starts in 1 hour.`,
      },
      {
        ms: 15 * 60 * 1000,
        id: `booking-15m-${bookingId}`,
        body: `Your call with ${peerName} starts in 15 minutes!`,
      },
    ];

    for (const { ms, id, body } of reminders) {
      const fireMs = meetingMs - ms;
      if (fireMs > now) {
        const trigger: TimestampTrigger = { type: TriggerType.TIMESTAMP, timestamp: fireMs };
        await notifee.createTriggerNotification(
          {
            id,
            title: '📞 Upcoming Call',
            body,
            android: { channelId: CHANNEL_ID, smallIcon: 'ic_launcher', pressAction: { id: 'default' } },
          },
          trigger,
        );
      }
    }
  } catch {
    // Notifications are best-effort — never block the booking flow
  }
}

export async function cancelBookingNotifications(bookingId: number): Promise<void> {
  try {
    await Promise.all([
      notifee.cancelNotification(`booking-24h-${bookingId}`),
      notifee.cancelNotification(`booking-1h-${bookingId}`),
      notifee.cancelNotification(`booking-15m-${bookingId}`),
      notifee.cancelNotification(`hope-wish-${bookingId}`),
    ]);
  } catch {}
}
