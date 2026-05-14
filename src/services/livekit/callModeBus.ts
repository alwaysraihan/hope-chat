/**
 * Lightweight pub-sub for in-call mode switches (audio <-> video). Used so the remote peer's
 * call screen can mirror the local user's "Switch to video"/"Switch to audio" action.
 *
 * Transport: LiveKit data channel, topic `hopechat.call_mode`. Payload is JSON, encoded with
 * the global TextEncoder polyfill that `livekit-client` requires.
 */

import type { Room, RemoteParticipant } from 'livekit-client';
import { RoomEvent } from 'livekit-client';

export type CallModeChangeMessage = {
  type: 'call_mode_change';
  /** New mode the sender just switched to. */
  mode: 'audio' | 'video';
  /** Room name — receiver should ignore if it doesn't match (stale data). */
  liveKitRoom: string;
  /** Wall-clock for dedup; receiver keeps the latest. */
  ts: number;
};

export const CALL_MODE_DATA_TOPIC = 'hopechat.call_mode';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function sendCallModeChange(
  room: Room | undefined | null,
  next: 'audio' | 'video',
): void {
  if (!room) return;
  try {
    const msg: CallModeChangeMessage = {
      type: 'call_mode_change',
      mode: next,
      liveKitRoom: room.name,
      ts: Date.now(),
    };
    const bytes = encoder.encode(JSON.stringify(msg));
    /** Reliable so a fleeting reconnect doesn't drop the mode flip. */
    void room.localParticipant
      .publishData(bytes, { reliable: true, topic: CALL_MODE_DATA_TOPIC })
      .catch(e => {
        if (__DEV__) console.warn('[callModeBus] publishData', e);
      });
  } catch (e) {
    if (__DEV__) console.warn('[callModeBus] send', e);
  }
}

/**
 * Subscribe to remote mode changes on a Room. The listener is called only for messages on the
 * `hopechat.call_mode` topic with matching room name.
 */
export function subscribeCallModeChanges(
  room: Room | undefined | null,
  listener: (msg: CallModeChangeMessage, from: RemoteParticipant | undefined) => void,
): () => void {
  if (!room) return () => undefined;

  const onData = (
    payload: Uint8Array,
    participant: RemoteParticipant | undefined,
    _kind: unknown,
    topic: string | undefined,
  ) => {
    if (topic !== CALL_MODE_DATA_TOPIC) return;
    try {
      const text = decoder.decode(payload);
      const json = JSON.parse(text) as CallModeChangeMessage | undefined;
      if (
        !json ||
        json.type !== 'call_mode_change' ||
        (json.mode !== 'audio' && json.mode !== 'video') ||
        typeof json.liveKitRoom !== 'string'
      ) {
        return;
      }
      if (json.liveKitRoom && json.liveKitRoom !== room.name) return;
      listener(json, participant);
    } catch (e) {
      if (__DEV__) console.warn('[callModeBus] decode', e);
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
