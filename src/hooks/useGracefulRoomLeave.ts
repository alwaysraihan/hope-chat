import { useCallback, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { useRoomContext } from '@livekit/react-native';
import { ConnectionState } from 'livekit-client';
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
        // Any further push/socket event for this room is stale now: mark it so a
        // late duplicate incoming-call event can't re-ring a call we just ended.
        if (room?.name) {
          try { markCallCancelled(room.name); } catch { /* */ }
        }
        // Signal the peer immediately so they end their side without the 30s wait.
        // Must happen before room.disconnect() closes the data channel.
        sendCallHangup(room);
        // ...and over the server, which reaches a peer who never joined the room
        // (still ringing) or whose data channel is already gone. Belt and braces:
        // whichever arrives first ends the call, the other is a no-op. Keyed on the
        // room, so every call screen gets this without knowing its conversation id.
        if (room?.name) {
          // Already connected => the call really happened; the server must not
          // write a "Missed call" row for it.
          const answered = room.state === ConnectionState.Connected;
          void notifyCallEndedByRoom({
            token: store.getState().auth.token,
            liveKitRoom: room.name,
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
  }, [beforeLeave, room, safePop]);
}
