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
 * When the user places an outbound call and the **remote peer never joins** the room,
 * we emit one bus event so the chat can append a “no answer” row (WhatsApp-style).
 * LiveKit “connected” only means signaling/WHFU — we require at least one remote participant.
 */
export function useOutgoingCallWithoutConnect(
  _room: Room | undefined,
  navigation: NavigationProp<Record<string, unknown>>,
  opts: Opts,
) {
  const peerJoinedRef = useRef(false);
  const emittedRef = useRef(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const remotes = useRemoteParticipants();
  useEffect(() => {
    if (remotes.length > 0) peerJoinedRef.current = true;
  }, [remotes.length]);

  const tryEmit = useCallback(() => {
    if (emittedRef.current) return;
    const o = optsRef.current;
    if (o.callDirection !== 'outgoing') return;
    const cid = o.conversationId?.trim();
    const pid = o.peerUserId?.trim();
    if (!cid || !pid) return;
    if (peerJoinedRef.current) return;
    emittedRef.current = true;
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
