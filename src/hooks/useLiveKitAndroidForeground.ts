import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import type { Room } from 'livekit-client';
import { ConnectionState, RoomEvent } from 'livekit-client';

import type {
  LiveKitCallForegroundContext,
  LiveKitCallForegroundKind,
} from '../services/livekit/liveKitCallForeground';
import {
  startLiveKitCallForeground,
  stopLiveKitCallForeground,
  updateLiveKitCallForegroundStatus,
} from '../services/livekit/liveKitCallForeground';

/** Let mic + signal settle before starting a camera-type foreground service (reduces native crashes). */
const ANDROID_VIDEO_FGS_DELAY_MS = 950;

/**
 * Android foreground service + ongoing notification while a LiveKit room session is active.
 */
export function useLiveKitAndroidForeground(
  room: Room | undefined,
  displayName: string,
  kind: LiveKitCallForegroundKind,
  /**
   * The room this notification represents. Without it the notification's
   * "Hang up" button cannot tell the server which call ended, so the peer is
   * left in a dead call.
   */
  liveKitRoom?: string,
  /** Peer / group photo for the ongoing-call notification's large icon. */
  avatarUrl?: string | null,
): void {
  const displayRef = useRef(displayName);
  displayRef.current = displayName;
  const roomNameRef = useRef(liveKitRoom);
  roomNameRef.current = liveKitRoom;
  const avatarRef = useRef(avatarUrl);
  avatarRef.current = avatarUrl;

  useEffect(() => {
    if (Platform.OS !== 'android' || !room) return;

    let active = false;
    let videoFsDelayTimer: ReturnType<typeof setTimeout> | undefined;

    const ctx = (): LiveKitCallForegroundContext => ({
      liveKitRoom: roomNameRef.current ?? '',
      displayName: displayRef.current,
      kind,
      avatarUrl: avatarRef.current ?? null,
    });

    const refreshFs = async (status: string) => {
      if (!active) return;
      try {
        await updateLiveKitCallForegroundStatus(
          displayRef.current,
          kind,
          status,
          ctx(),
        );
      } catch (e) {
        console.warn('[LiveKit FGS] refreshFs', e);
      }
    };

    const syncFromState = async () => {
      try {
        const cs = room.state;
        if (cs === ConnectionState.Connected) {
          active = true;
          if (kind === 'video') {
            if (videoFsDelayTimer) {
              clearTimeout(videoFsDelayTimer);
            }
            videoFsDelayTimer = setTimeout(() => {
              videoFsDelayTimer = undefined;
              void (async () => {
                try {
                  if (room.state !== ConnectionState.Connected) {
                    return;
                  }
                  await startLiveKitCallForeground(
                    displayRef.current,
                    kind,
                    'Video · Connected',
                    ctx(),
                  );
                } catch (e) {
                  console.warn('[LiveKit FGS] delayed video start', e);
                }
              })();
            }, ANDROID_VIDEO_FGS_DELAY_MS);
            return;
          }
          await startLiveKitCallForeground(
            displayRef.current,
            kind,
            'Voice · Connected',
            ctx(),
          );
          return;
        }
        // Show the notification while still CONNECTING too.
        //
        // It previously appeared only once connected, so during the connecting
        // phase there was nothing to tap and nothing to hang up from — which is
        // why a call stuck on "Connecting…" could neither be returned to nor
        // ended from the shade. `refreshFs` is a no-op until `active`, so this
        // has to start the service rather than update it.
        if (cs === ConnectionState.Connecting) {
          active = true;
          await startLiveKitCallForeground(
            displayRef.current,
            kind,
            kind === 'video' ? 'Video · Connecting…' : 'Voice · Connecting…',
            ctx(),
            // Audio-only service types until connected — see serviceKind.
            'audio',
          );
          return;
        }
        if (cs === ConnectionState.Reconnecting) {
          active = true;
          await refreshFs(
            kind === 'video' ? 'Video · Reconnecting…' : 'Voice · Reconnecting…',
          );
        }
      } catch (e) {
        console.warn('[LiveKit FGS] syncFromState', e);
      }
    };

    const onConnected = () => {
      void syncFromState();
    };
    const onReconnecting = () => {
      active = true;
      void refreshFs(
        kind === 'video'
          ? 'Video · Poor connection · Reconnecting…'
          : 'Voice · Poor connection · Reconnecting…',
      );
    };
    const onReconnected = () => {
      void refreshFs(
        kind === 'video' ? 'Video · Connected' : 'Voice · Connected',
      );
    };
    const onDisconnected = async () => {
      active = false;
      try {
        await stopLiveKitCallForeground();
      } catch (e) {
        console.warn('[LiveKit FGS] stop on disconnect', e);
      }
    };

    const onConnectionStateChanged = () => {
      void syncFromState();
    };

    room.on(RoomEvent.Connected, onConnected);
    room.on(RoomEvent.ConnectionStateChanged, onConnectionStateChanged);
    room.on(RoomEvent.Reconnecting, onReconnecting);
    room.on(RoomEvent.Reconnected, onReconnected);
    room.on(RoomEvent.Disconnected, onDisconnected);

    void syncFromState();

    return () => {
      if (videoFsDelayTimer) {
        clearTimeout(videoFsDelayTimer);
      }
      room.off(RoomEvent.Connected, onConnected);
      room.off(RoomEvent.ConnectionStateChanged, onConnectionStateChanged);
      room.off(RoomEvent.Reconnecting, onReconnecting);
      room.off(RoomEvent.Reconnected, onReconnected);
      room.off(RoomEvent.Disconnected, onDisconnected);
      void stopLiveKitCallForeground().catch(e =>
        console.warn('[LiveKit FGS] cleanup stop', e),
      );
    };
  }, [room, kind]);
}
