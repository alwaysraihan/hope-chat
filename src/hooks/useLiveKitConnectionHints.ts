import { useEffect, useState } from 'react';
import type { Room } from 'livekit-client';
import {
  ConnectionQuality,
  ParticipantEvent,
  RoomEvent,
  type Participant,
} from 'livekit-client';

export type LiveKitUiHint =
  | 'ok'
  | 'reconnecting'
  | 'poor_network'
  | 'disconnected';

/**
 * Connection messaging when the signal is flaky (narrow / slow links).
 */
export function useLiveKitConnectionHints(room: Room | undefined): {
  hint: LiveKitUiHint;
  detail: string;
} {
  const [hint, setHint] = useState<LiveKitUiHint>('ok');
  const [detail, setDetail] = useState('');

  useEffect(() => {
    if (!room) return;

    const reconnecting = () => {
      setHint('reconnecting');
      setDetail('Reconnecting…');
    };
    const signalReconnecting = () => {
      setHint('reconnecting');
      setDetail('Signal reconnecting…');
    };
    const reconnected = () => {
      setHint('ok');
      setDetail('');
    };
    const disconnected = () => {
      setHint('disconnected');
      setDetail('');
    };

    room.on(RoomEvent.Reconnecting, reconnecting);
    room.on(RoomEvent.SignalReconnecting, signalReconnecting);
    room.on(RoomEvent.Reconnected, reconnected);
    room.on(RoomEvent.Disconnected, disconnected);

    const cleanups: Array<() => void> = [];

    const watchParticipant = (p: Participant | undefined | null) => {
      if (!p || p.isLocal) return;
      const onQuality = () => {
        const q = p.connectionQuality as ConnectionQuality;
        if (q === ConnectionQuality.Poor || q === ConnectionQuality.Lost) {
          setHint('poor_network');
          setDetail('Weak signal — audio will continue; video may pause.');
          return;
        }
        setHint(curr => (curr === 'poor_network' ? 'ok' : curr));
        setDetail('');
      };
      p.on(ParticipantEvent.ConnectionQualityChanged, onQuality);
      onQuality();
      cleanups.push(() =>
        p.off(ParticipantEvent.ConnectionQualityChanged, onQuality),
      );
    };

    const remote = Array.from(room.remoteParticipants.values())[0];
    watchParticipant(remote);

    return () => {
      room.off(RoomEvent.Reconnecting, reconnecting);
      room.off(RoomEvent.SignalReconnecting, signalReconnecting);
      room.off(RoomEvent.Reconnected, reconnected);
      room.off(RoomEvent.Disconnected, disconnected);
      cleanups.forEach(fn => fn());
    };
  }, [room]);

  return { hint, detail };
}
