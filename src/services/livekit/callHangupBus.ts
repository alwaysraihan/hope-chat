/**
 * Data-channel signal for "I'm hanging up" sent right before room.disconnect().
 * The remote peer receives this and immediately ends their side instead of
 * waiting for the 30-second remote-left fallback timer.
 *
 * Pattern mirrors callModeBus.ts (same topic/encoder approach).
 */

import type { Room, RemoteParticipant } from 'livekit-client';
import { RoomEvent } from 'livekit-client';

export const CALL_HANGUP_TOPIC = 'hopechat.call_hangup';

type HangupMessage = {
  type: 'call_hangup';
  liveKitRoom: string;
  ts: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Fire-and-forget: publish a hangup signal so the remote peer ends immediately.
 * Must be called before room.disconnect() — the data channel closes on disconnect.
 */
export function sendCallHangup(room: Room | undefined | null): void {
  if (!room) return;
  try {
    const msg: HangupMessage = {
      type: 'call_hangup',
      liveKitRoom: room.name,
      ts: Date.now(),
    };
    const bytes = encoder.encode(JSON.stringify(msg));
    void room.localParticipant
      .publishData(bytes, { reliable: true, topic: CALL_HANGUP_TOPIC })
      .catch(e => {
        if (__DEV__) console.warn('[callHangupBus] publishData', e);
      });
  } catch (e) {
    if (__DEV__) console.warn('[callHangupBus] send', e);
  }
}

/**
 * Subscribe to the remote hangup signal. Returns an unsubscribe thunk.
 * The listener is called at most once per valid hangup message for this room.
 */
export function subscribeCallHangup(
  room: Room | undefined | null,
  listener: () => void,
): () => void {
  if (!room) return () => undefined;

  const onData = (
    payload: Uint8Array,
    _participant: RemoteParticipant | undefined,
    _kind: unknown,
    topic: string | undefined,
  ) => {
    if (topic !== CALL_HANGUP_TOPIC) return;
    try {
      const text = decoder.decode(payload);
      const json = JSON.parse(text) as HangupMessage | undefined;
      if (!json || json.type !== 'call_hangup') return;
      if (json.liveKitRoom && json.liveKitRoom !== room.name) return;
      listener();
    } catch (e) {
      if (__DEV__) console.warn('[callHangupBus] decode', e);
    }
  };

  room.on(RoomEvent.DataReceived, onData);
  return () => {
    try {
      room.off(RoomEvent.DataReceived, onData);
    } catch {
      /* */
    }
  };
}
