import { useCallback, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { useRoomContext } from '@livekit/react-native';
import { ConnectionState } from 'livekit-client';
import { sendCallHangup } from '../services/livekit/callHangupBus';
import { notifyCallEndedByRoom } from '../services/invitePeerToHopeChatCall';
import { store } from '../redux/store';
import { markCallCancelled } from '../services/incomingCall/navigateIncomingCall';

/** Teardown budget. Past this we pop the screen anyway and let LiveKit finish in the background. */
const TEARDOWN_TIMEOUT_MS = 1500;

function withTimeout<T>(p: Promise<T> | undefined, ms: number): Promise<void> {
  if (!p) return Promise.resolve();
  return new Promise<void>(resolve => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const timer = setTimeout(done, ms);
    p.then(done, done).finally?.(() => clearTimeout(timer));
  });
}

type Options = {
  safePop: () => void;
  /** e.g. outgoing “no peer” chat row — run before tracks stop */
  beforeLeave?: () => void;
};

/**
 * Stops local camera/mic before disconnect to reduce native WebRTC teardown crashes on Android.
 * Also sends a data-channel hangup signal to the peer so they end immediately
 * instead of waiting for the 30-second remote-left fallback timer.
 */
export function useGracefulRoomLeave({ safePop, beforeLeave }: Options) {
  const room = useRoomContext();
  const leavingRef = useRef(false);

  return useCallback(async () => {
    if (leavingRef.current) {
      return;
    }
    leavingRef.current = true;

    /**
     * The screen must leave even if native teardown stalls. While the room is
     * still CONNECTING, `room.disconnect()` can hang on the pending signal
     * handshake — awaiting it unconditionally is what made the End button feel
     * dead during "Calling…". So the pop is scheduled up front on its own
     * timer and teardown races against a hard budget.
     */
    let popped = false;
    const popOnce = () => {
      if (popped) return;
      popped = true;
      try {
        safePop();
      } catch {
        /* navigation must never throw */
      }
    };
    const popTimer = setTimeout(popOnce, TEARDOWN_TIMEOUT_MS);

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
        await withTimeout(
          Promise.all([
            lp.setScreenShareEnabled(false).catch(() => undefined),
            lp.setCameraEnabled(false).catch(() => undefined),
            lp.setMicrophoneEnabled(false).catch(() => undefined),
          ]),
          600,
        );
      }
      await new Promise<void>(resolve => {
        InteractionManager.runAfterInteractions(() => resolve());
      });
      await withTimeout(
        room?.disconnect().catch(e => {
          console.warn('[LiveKit] room.disconnect', e);
        }),
        TEARDOWN_TIMEOUT_MS,
      );
    } catch (e) {
      console.warn('[LiveKit] graceful leave', e);
    } finally {
      // leavingRef stays true — no re-entry after the call ends.
      clearTimeout(popTimer);
      setTimeout(popOnce, 80);
    }
  }, [beforeLeave, room, safePop]);
}
