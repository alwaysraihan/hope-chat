import { useCallback, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { useRoomContext } from '@livekit/react-native';
import { useRoute } from '@react-navigation/native';
import { sendCallHangup } from '../services/livekit/callHangupBus';
import { notifyCallEndedByRoom } from '../services/invitePeerToHopeChatCall';
import { store } from '../redux/store';
import { markCallCancelled } from '../services/incomingCall/navigateIncomingCall';

type Options = {
  safePop: () => void;
  /** e.g. outgoing “no peer” chat row — run before tracks stop */
  beforeLeave?: () => void;
};

/**
 * Ending a call must feel instant: the screen pops the moment the button is
 * pressed, never waiting on native WebRTC teardown. Everything LiveKit-side
 * (peer hangup signal, disabling tracks, `room.disconnect()`) still happens,
 * just as fire-and-forget work after the pop instead of gating it — that is
 * what used to leave a "Call ended" screen briefly visible (or stuck, if
 * teardown stalled) between the tap and the nav actually landing.
 */
export function useGracefulRoomLeave({ safePop, beforeLeave }: Options) {
  const room = useRoomContext();
  // `room.name` stays EMPTY until the LiveKit connect completes. Keying the
  // teardown on it alone meant a caller who hung up during "Calling…" sent no
  // cancel at all — the callee's phone kept ringing for the full minute. The
  // call screen's route always knows the room.
  const route = useRoute();
  const routeRoom = String(
    (route?.params as { liveKitRoom?: string } | undefined)?.liveKitRoom ?? '',
  ).trim();
  const leavingRef = useRef(false);

  return useCallback(() => {
    if (leavingRef.current) {
      return;
    }
    leavingRef.current = true;

    try {
      safePop();
    } catch {
      /* navigation must never throw */
    }

    void (async () => {
      try {
        beforeLeave?.();
        const roomName = room?.name || routeRoom;
        // Any further push/socket event for this room is stale now: mark it so a
        // late duplicate incoming-call event can't re-ring a call we just ended.
        if (roomName) {
          try { markCallCancelled(roomName); } catch { /* */ }
        }
        // Signal the peer immediately so they end their side without the 30s wait.
        // Must happen before room.disconnect() closes the data channel.
        sendCallHangup(room);
        // ...and over the server, which reaches a peer who never joined the room
        // (still ringing) or whose data channel is already gone. Belt and braces:
        // whichever arrives first ends the call, the other is a no-op. Keyed on the
        // room, so every call screen gets this without knowing its conversation id.
        if (roomName) {
          // Answered = the other person actually joined. Our OWN room being
          // connected says nothing: a caller is connected the whole time the
          // callee's phone rings, and treating that as "answered" logged no
          // missed call and showed the callee no "Missed call" banner.
          const answered = (room?.remoteParticipants?.size ?? 0) > 0;
          void notifyCallEndedByRoom({
            token: store.getState().auth.token,
            liveKitRoom: roomName,
            reason: answered ? 'hangup' : undefined,
          });
        }
        const lp = room?.localParticipant;
        if (lp) {
          await Promise.all([
            lp.setScreenShareEnabled(false).catch(() => undefined),
            lp.setCameraEnabled(false).catch(() => undefined),
            lp.setMicrophoneEnabled(false).catch(() => undefined),
          ]);
        }
        await new Promise<void>(resolve => {
          InteractionManager.runAfterInteractions(() => resolve());
        });
        await room?.disconnect().catch(e => {
          console.warn('[LiveKit] room.disconnect', e);
        });
      } catch (e) {
        console.warn('[LiveKit] graceful leave', e);
      }
    })();
  }, [beforeLeave, room, routeRoom, safePop]);
}
