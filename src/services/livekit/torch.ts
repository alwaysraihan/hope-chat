import { NativeModules } from 'react-native';

/**
 * Torch (flashlight) for the camera a call is capturing from.
 *
 * WebRTC holds the camera open, so the OS torch API can't be used; the native
 * HopeChatTorch module (android/.../HopeChatTorchModule.kt, ios/hopeChat/HopeChatTorch.m)
 * sets the flash on WebRTC's live capture session instead. Any new capture
 * session (camera switch, restartTrack, camera off/on, call end) drops the
 * torch on its own, so callers should reset their state at those points.
 */
type NativeTorch = {
  isTorchAvailable(): Promise<boolean>;
  setTorch(on: boolean, trackId: string | null): Promise<boolean>;
};

const native = NativeModules.HopeChatTorch as NativeTorch | undefined;

/** True when the device has a back camera with a flash. */
export async function isTorchAvailable(): Promise<boolean> {
  if (!native) return false;
  try {
    return await native.isTorchAvailable();
  } catch {
    return false;
  }
}

/**
 * Turns the torch on/off. `trackId` is the local camera MediaStreamTrack id;
 * null applies it to every local camera track. Rejects when there is no
 * running camera with a flash.
 */
export async function setTorch(on: boolean, trackId: string | null): Promise<void> {
  if (!native) throw new Error('HopeChatTorch native module missing');
  await native.setTorch(on, trackId);
}
