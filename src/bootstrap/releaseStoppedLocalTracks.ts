/**
 * Make `MediaStreamTrack.stop()` free the native track for local tracks.
 *
 * In react-native-webrtc `stop()` only flips `enabled` off — the native
 * capturer, its SurfaceTextureHelper and the track live on until `release()`,
 * which livekit-client never calls. Two visible consequences:
 *
 *  - Android screen share: the capturer's dispose() is what stops WebRTC's
 *    MediaProjectionService, so after a share (or the whole call) ended the
 *    app stayed a foreground service — "Hopechat is running" — with no call.
 *  - Every camera/mic track of every call leaked its native resources.
 *
 * Releasing a track that a view still renders is safe: WebRTCView guards
 * addSink/removeSink against an already released track. Must run before any
 * call starts (index.js, right after registerGlobals).
 */
import { MediaStreamTrack } from '@livekit/react-native-webrtc';

type ReleasableTrack = {
  remote: boolean;
  stop: () => void;
  release: () => void;
};

const proto = MediaStreamTrack.prototype as unknown as ReleasableTrack & {
  __hopechatReleaseOnStop?: boolean;
};

if (!proto.__hopechatReleaseOnStop) {
  proto.__hopechatReleaseOnStop = true;
  const released = new WeakSet<object>();
  const originalStop = proto.stop;

  proto.stop = function stopAndRelease(this: ReleasableTrack) {
    originalStop.call(this);
    if (this.remote || released.has(this)) return;
    released.add(this);
    try {
      this.release();
    } catch {
      /* already gone natively */
    }
  };
}
