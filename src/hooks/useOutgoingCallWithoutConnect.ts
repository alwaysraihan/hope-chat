import { useEffect, useRef, useCallback } from 'react';
import type { NavigationProp } from '@react-navigation/native';
import { useRemoteParticipants } from '@livekit/react-native';
import type { Room } from 'livekit-client';

import { emitCallOutcome } from '../services/callOutcomeBus';
import { notifyPeerCallRejected } from '../services/invitePeerToHopeChatCall';
import { store } from '../redux/store';

type Opts = {
  callDirection?: 'outgoing' | 'incoming';
  conversationId?: string | null;
  peerUserId?: string | null;
  liveKitRoom?: string | null;
  callKind: 'audio' | 'video';
  peerDisplayName?: string;
};

/**
 * Outbound call chat history:
 * - If the peer **never** joins → `outgoing_not_connected` (“No answer”).
 * - If the peer **joins** → on leave, `call_completed` with talk duration (outgoing only).
 */
export function useOutgoingCallWithoutConnect(
  _room: Room | undefined,
  navigation: NavigationProp<Record<string, unknown>>,
  opts: Opts,
) {
  const peerJoinedRef = useRef(false);
  const emittedRef = useRef(false);
  const connectedAtMsRef = useRef<number | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const remotes = useRemoteParticipants();
  useEffect(() => {
    if (remotes.length > 0) {
      peerJoinedRef.current = true;
      if (connectedAtMsRef.current == null) {
        connectedAtMsRef.current = Date.now();
      }
    }
  }, [remotes.length]);

  const tryEmit = useCallback(() => {
    if (emittedRef.current) return;
    const o = optsRef.current;
    if (o.callDirection !== 'outgoing') return;
    const cid = o.conversationId?.trim();
    const pid = o.peerUserId?.trim() || undefined;
    // Allow group calls through even without a peerUserId — groups have no
    // single peer, but the call log still needs to appear in the group chat.
    if (!cid) return;
    emittedRef.current = true;

    if (peerJoinedRef.current && connectedAtMsRef.current != null) {
      const sec = Math.max(
        1,
        Math.round((Date.now() - connectedAtMsRef.current) / 1000),
      );
      emitCallOutcome({
        conversationId: cid,
        callKind: o.callKind,
        variant: 'call_completed',
        peerUserId: pid,
        peerDisplayName: o.peerDisplayName,
        durationSeconds: sec,
      });
      return;
    }

    emitCallOutcome({
      conversationId: cid,
      callKind: o.callKind,
      variant: 'outgoing_not_connected',
      peerUserId: pid,
      peerDisplayName: o.peerDisplayName,
    });

    // Tell the backend to cancel the ring on the callee's side immediately.
    // The callee's IncomingCallScreen only receives data-channel hangups once they
    // join LiveKit — if they haven't answered yet they need an FCM cancel instead.
    const room = o.liveKitRoom?.trim();
    const token = store.getState().auth.token;
    if (token && room) {
      void notifyPeerCallRejected({ token, conversationId: cid, liveKitRoom: room });
    }
  }, []);

  useEffect(() => {
    const sub = navigation.addListener('beforeRemove', tryEmit);
    return () => {
      tryEmit();
      sub();
    };
  }, [navigation, tryEmit]);

  return { tryEmitOutgoingWithoutConnect: tryEmit };
}
