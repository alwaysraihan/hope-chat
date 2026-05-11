import { useEffect, useRef, useCallback } from 'react';
import type { NavigationProp } from '@react-navigation/native';
import { useRemoteParticipants } from '@livekit/react-native';
import type { Room } from 'livekit-client';

import { emitCallOutcome } from '../services/callOutcomeBus';

type Opts = {
  callDirection?: 'outgoing' | 'incoming';
  conversationId?: string | null;
  peerUserId?: string | null;
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
    const pid = o.peerUserId?.trim();
    if (!cid || !pid) return;
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
