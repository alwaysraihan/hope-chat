import { useCallback, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { useRoomContext } from '@livekit/react-native';

type Options = {
  safePop: () => void;
  /** e.g. outgoing “no peer” chat row — run before tracks stop */
  beforeLeave?: () => void;
};

/**
 * Stops local camera/mic before disconnect to reduce native WebRTC teardown crashes on Android.
 */
export function useGracefulRoomLeave({ safePop, beforeLeave }: Options) {
  const room = useRoomContext();
  const leavingRef = useRef(false);

  return useCallback(async () => {
    if (leavingRef.current) {
      return;
    }
    leavingRef.current = true;
    try {
      beforeLeave?.();
      const lp = room?.localParticipant;
      if (lp) {
        await lp.setScreenShareEnabled(false).catch(e => {
          console.warn('[LiveKit] setScreenShareEnabled(false)', e);
        });
        await lp.setCameraEnabled(false).catch(e => {
          console.warn('[LiveKit] setCameraEnabled(false)', e);
        });
        await lp.setMicrophoneEnabled(false).catch(e => {
          console.warn('[LiveKit] setMicrophoneEnabled(false)', e);
        });
      }
      await new Promise<void>(resolve => {
        InteractionManager.runAfterInteractions(() => resolve());
      });
      await new Promise<void>(resolve => {
        requestAnimationFrame(() => resolve());
      });
      await room?.disconnect().catch(e => {
        console.warn('[LiveKit] room.disconnect', e);
      });
    } catch (e) {
      console.warn('[LiveKit] graceful leave', e);
    } finally {
      setTimeout(() => {
        leavingRef.current = false;
        try {
          safePop();
        } catch {
          /* navigation must never throw */
        }
      }, 80);
    }
  }, [beforeLeave, room, safePop]);
}
