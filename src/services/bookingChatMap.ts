import { createMMKV } from 'react-native-mmkv';

let _store: ReturnType<typeof createMMKV> | null = null;
function store() {
  if (!_store) _store = createMMKV({ id: 'hopechat-booking-chat-map-v1' });
  return _store;
}

/** Persist the link between a chat thread and its booking after booking succeeds.
 *  Writes both directions so either side can look up the other. */
export function setBookingForChat(chatId: string, bookingId: number): void {
  try {
    store().set(`chat:${chatId}`, bookingId);
    store().set(`booking:${bookingId}`, chatId);
  } catch {}
}

/** Retrieve the bookingId linked to a chat thread, or undefined if none. */
export function getBookingForChat(chatId: string): number | undefined {
  try {
    return store().getNumber(`chat:${chatId}`) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Retrieve the chatId linked to a booking, or undefined if none.
 *  Populated by setBookingForChat — use as a fast local lookup before
 *  falling back to the API. */
export function getChatForBooking(bookingId: number): string | undefined {
  try {
    return store().getString(`booking:${bookingId}`) ?? undefined;
  } catch {
    return undefined;
  }
}
