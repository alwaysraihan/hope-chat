import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, ToastAndroid } from 'react-native';
import { AudioSession } from '@livekit/react-native';

/**
 * Logical audio-output kinds we expose to the UI. The LiveKit native API uses
 * different string identifiers per platform — we normalize them so the call
 * screens can render a consistent picker.
 *
 *  - `earpiece`    : phone earpiece speaker (call-style)
 *  - `speaker`     : built-in loudspeaker
 *  - `wired`       : 3.5mm / USB-C / Lightning wired headset
 *  - `bluetooth`   : any Bluetooth audio device (headphones, earbuds, car, hearing aid)
 *  - `route_picker`: iOS-only stub that, when "selected", opens AVRoutePickerView
 *                    so the user can pick between bluetooth / AirPlay devices the
 *                    LiveKit native API doesn't enumerate by name.
 */
export type AudioOutputKind =
  | 'earpiece'
  | 'speaker'
  | 'wired'
  | 'bluetooth'
  | 'route_picker';

export type AudioOutputDevice = {
  /** Stable id we use for selection / list keys. */
  id: AudioOutputKind;
  /** Human-readable label shown in the bottom sheet. */
  label: string;
  /** True when this is the currently routed output. */
  isActive: boolean;
  /**
   * The raw deviceId string LiveKit's AudioSession expects when calling
   * `selectAudioOutput`. `null` for the iOS-only `route_picker` pseudo-item.
   */
  nativeId: string | null;
};

const ANDROID_KIND_BY_NATIVE: Record<string, AudioOutputKind> = {
  speaker: 'speaker',
  earpiece: 'earpiece',
  headset: 'wired',
  bluetooth: 'bluetooth',
};

const ANDROID_NATIVE_BY_KIND: Record<AudioOutputKind, string | null> = {
  speaker: 'speaker',
  earpiece: 'earpiece',
  wired: 'headset',
  bluetooth: 'bluetooth',
  route_picker: null,
};

const KIND_LABEL: Record<AudioOutputKind, string> = {
  earpiece: 'Phone',
  speaker: 'Speaker',
  wired: 'Headphones',
  bluetooth: 'Bluetooth',
  route_picker: 'Other devices…',
};

/**
 * The LiveKit Android API hands back an active-device string via the same
 * `getAudioOutputs` shape used for the list, so we have to keep our own
 * "currently selected" memory. For iOS we mirror the speaker toggle.
 */
type Snapshot = {
  outputs: AudioOutputDevice[];
  activeId: AudioOutputKind | null;
};

function buildIOSOutputs(activeId: AudioOutputKind | null): AudioOutputDevice[] {
  // iOS exposes only `default` (= "route to whatever AVAudioSession picked,
  // which honours bluetooth/wired automatically") and `force_speaker`. To let
  // users pick a *specific* bluetooth device we add a "route_picker" entry
  // that opens AVRoutePickerView.
  const items: AudioOutputDevice[] = [
    {
      id: 'earpiece',
      label: 'Phone',
      isActive: activeId === 'earpiece',
      nativeId: 'default',
    },
    {
      id: 'speaker',
      label: 'Speaker',
      isActive: activeId === 'speaker',
      nativeId: 'force_speaker',
    },
    {
      id: 'route_picker',
      label: 'Bluetooth / AirPlay…',
      isActive: false,
      nativeId: null,
    },
  ];
  return items;
}

function buildAndroidOutputs(
  rawOutputs: string[],
  activeId: AudioOutputKind | null,
): AudioOutputDevice[] {
  // Always surface earpiece + speaker even if the native side hasn't reported
  // them yet (during the first frame after startAudioSession).
  const fallback = new Set<AudioOutputKind>(['earpiece', 'speaker']);
  for (const raw of rawOutputs) {
    const kind = ANDROID_KIND_BY_NATIVE[raw];
    if (kind) fallback.add(kind);
  }

  const ordered: AudioOutputKind[] = ['bluetooth', 'wired', 'speaker', 'earpiece'];
  return ordered
    .filter(kind => fallback.has(kind))
    .map(kind => ({
      id: kind,
      label: KIND_LABEL[kind],
      isActive: activeId === kind,
      nativeId: ANDROID_NATIVE_BY_KIND[kind],
    }));
}

function emitToast(message: string) {
  if (Platform.OS === 'android') {
    try {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } catch {
      /* defensive — never crash a live call over UX feedback */
    }
  }
  // On iOS we intentionally swallow — call screens render an in-call banner.
}

/**
 * Tracks the available audio outputs for the active LiveKit call and lets the
 * UI switch between them. Polls the LiveKit native side every 2 seconds and on
 * app foreground because the SDK doesn't emit a dedicated route-change event.
 *
 * Returns a tuple of:
 *  - `outputs`              : ordered list of devices for the picker sheet.
 *  - `active`               : currently routed device (or null when unknown).
 *  - `select(deviceOrKind)` : route audio to that device.
 *  - `openIOSRoutePicker()` : trigger AVRoutePickerView (iOS only).
 *  - `autoSwitchMessage`    : last toast string raised by an auto-switch, so a
 *                              call screen can render a transient banner.
 *  - `clearAutoSwitchMessage()`
 */
export function useCallAudio(opts?: {
  /** Default route picked when the call connects. Defaults to `earpiece` for
   * voice calls; pass `speaker` for video calls. */
  preferred?: 'earpiece' | 'speaker';
  /** Whether the hook should run. Pass false to pause polling when off-screen. */
  enabled?: boolean;
}) {
  const preferred: AudioOutputKind = opts?.preferred ?? 'earpiece';
  const enabled = opts?.enabled !== false;

  const [snapshot, setSnapshot] = useState<Snapshot>(() =>
    Platform.OS === 'ios'
      ? { outputs: buildIOSOutputs(preferred), activeId: preferred }
      : { outputs: buildAndroidOutputs([], preferred), activeId: preferred },
  );
  const [autoSwitchMessage, setAutoSwitchMessage] = useState<string | null>(null);

  // Tracks the previously-seen bluetooth/wired availability so we only
  // auto-switch on a *new* connection, not on every poll cycle.
  const lastAvailableRef = useRef<Set<AudioOutputKind>>(new Set());
  const activeIdRef = useRef<AudioOutputKind | null>(preferred);
  const userPickedRef = useRef(false); // becomes true after first manual select
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      if (Platform.OS === 'ios') {
        // iOS doesn't enumerate per-device names through LiveKit. We keep the
        // last-known active id and just confirm the snapshot is rendered.
        if (!mountedRef.current) return;
        setSnapshot({
          outputs: buildIOSOutputs(activeIdRef.current),
          activeId: activeIdRef.current,
        });
        return;
      }

      const raw = await AudioSession.getAudioOutputs();
      if (!mountedRef.current) return;

      const available = new Set<AudioOutputKind>();
      for (const r of raw) {
        const kind = ANDROID_KIND_BY_NATIVE[r];
        if (kind) available.add(kind);
      }

      // Detect "a new wireless/wired device just appeared" → auto-route.
      const previous = lastAvailableRef.current;
      const newlyAppeared: AudioOutputKind[] = [];
      for (const kind of ['bluetooth', 'wired'] as AudioOutputKind[]) {
        if (available.has(kind) && !previous.has(kind)) newlyAppeared.push(kind);
      }
      lastAvailableRef.current = available;

      let nextActive = activeIdRef.current;

      if (newlyAppeared.length > 0) {
        // Prefer bluetooth over wired when both come online at once — matches
        // the order LiveKit's own preferredOutputList uses.
        const target =
          newlyAppeared.find(k => k === 'bluetooth') ?? newlyAppeared[0];
        try {
          const nativeId = ANDROID_NATIVE_BY_KIND[target];
          if (nativeId) {
            await AudioSession.selectAudioOutput(nativeId);
            nextActive = target;
            activeIdRef.current = target;
            const msg =
              target === 'bluetooth'
                ? 'Audio routed to Bluetooth'
                : 'Audio routed to headphones';
            emitToast(msg);
            if (mountedRef.current) setAutoSwitchMessage(msg);
          }
        } catch (err) {
          // Don't block the picker UI if the SDK rejects the route.
          // eslint-disable-next-line no-console
          console.warn('[useCallAudio] auto-switch failed', err);
        }
      }

      // Also handle "device disappeared while it was active" — fall back to
      // the user's previous preference (earpiece for voice, speaker for video).
      if (
        nextActive &&
        (nextActive === 'bluetooth' || nextActive === 'wired') &&
        !available.has(nextActive)
      ) {
        const fallback: AudioOutputKind = preferred;
        try {
          const nativeId = ANDROID_NATIVE_BY_KIND[fallback];
          if (nativeId) {
            await AudioSession.selectAudioOutput(nativeId);
            nextActive = fallback;
            activeIdRef.current = fallback;
          }
        } catch {
          /* ignore — best-effort */
        }
      }

      if (mountedRef.current) {
        setSnapshot({
          outputs: buildAndroidOutputs(raw, nextActive),
          activeId: nextActive,
        });
      }
    } catch (err) {
      // Audio session may not be ready yet right after navigation — silent retry.
      // eslint-disable-next-line no-console
      console.warn('[useCallAudio] refresh', err);
    }
  }, [preferred]);

  // Poll every 2s and on app foreground.
  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, 2000);
    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
    });
    return () => {
      clearInterval(interval);
      appStateSub.remove();
    };
  }, [enabled, refresh]);

  const select = useCallback(
    async (device: AudioOutputDevice | AudioOutputKind) => {
      const kind: AudioOutputKind =
        typeof device === 'string' ? device : device.id;

      if (kind === 'route_picker') {
        if (Platform.OS === 'ios') {
          try {
            await AudioSession.showAudioRoutePicker();
          } catch (err) {
            // eslint-disable-next-line no-console
            console.warn('[useCallAudio] route picker', err);
          }
        }
        return;
      }

      const nativeId =
        Platform.OS === 'ios'
          ? kind === 'speaker'
            ? 'force_speaker'
            : 'default'
          : ANDROID_NATIVE_BY_KIND[kind];
      if (!nativeId) return;

      try {
        await AudioSession.selectAudioOutput(nativeId);
        userPickedRef.current = true;
        activeIdRef.current = kind;
        if (mountedRef.current) {
          setSnapshot(prev => ({
            outputs:
              Platform.OS === 'ios'
                ? buildIOSOutputs(kind)
                : prev.outputs.map(o => ({ ...o, isActive: o.id === kind })),
            activeId: kind,
          }));
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[useCallAudio] selectAudioOutput', err);
      }
    },
    [],
  );

  const openIOSRoutePicker = useCallback(async () => {
    if (Platform.OS !== 'ios') return;
    try {
      await AudioSession.showAudioRoutePicker();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[useCallAudio] showAudioRoutePicker', err);
    }
  }, []);

  const clearAutoSwitchMessage = useCallback(() => {
    setAutoSwitchMessage(null);
  }, []);

  return useMemo(
    () => ({
      outputs: snapshot.outputs,
      active: snapshot.outputs.find(o => o.isActive) ?? null,
      activeId: snapshot.activeId,
      select,
      openIOSRoutePicker,
      autoSwitchMessage,
      clearAutoSwitchMessage,
      hasMultipleOutputs:
        snapshot.outputs.filter(o => o.id !== 'route_picker').length > 1,
    }),
    [
      autoSwitchMessage,
      clearAutoSwitchMessage,
      openIOSRoutePicker,
      select,
      snapshot,
    ],
  );
}
