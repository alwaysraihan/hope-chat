import { useState, useCallback } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { Toast } from '../components/Toast';
import RNFS from 'react-native-fs';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DownloadState = 'idle' | 'downloading' | 'done' | 'error';
export type DownloadMediaType = 'image' | 'video' | 'auto' | undefined;

interface UseMediaDownloadReturn {
  downloadState: DownloadState;
  progress: number; // 0 → 1
  download: (uri: string, type: DownloadMediaType) => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Android:
 * - API 33+ (Android 13+) → no WRITE permission needed for saving
 * - API 32 and below → WRITE_EXTERNAL_STORAGE required
 *
 * iOS:
 * - Requires NSPhotoLibraryAddUsageDescription in Info.plist
 */
async function ensureAndroidPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  // Android 13+
  if (Platform.Version >= 33) {
    return true;
  }

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    {
      title: 'Save to Gallery',
      message: 'Allow this app to save media to your gallery.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    },
  );

  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * Create a clean local path for temporary download.
 * Keeps original extension if possible.
 */
function buildLocalPath(uri: string, type: 'image' | 'video'): string {
  const originalName =
    uri.split('/').pop()?.split('?')[0] || `media_${Date.now()}`;

  const hasExtension = originalName.includes('.');

  const ext = hasExtension
    ? originalName.split('.').pop()
    : type === 'video'
    ? 'mp4'
    : 'jpg';

  const base = hasExtension
    ? originalName.split('.').slice(0, -1).join('.')
    : originalName;

  return `${RNFS.CachesDirectoryPath}/${base}_${Date.now()}.${ext}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMediaDownload(): UseMediaDownloadReturn {
  const [downloadState, setDownloadState] = useState<DownloadState>('idle');
  const [progress, setProgress] = useState(0);

  const resetState = () => {
    setTimeout(() => {
      setDownloadState('idle');
      setProgress(0);
    }, 2500);
  };

  const download = useCallback(
    async (uri: string, type: DownloadMediaType) => {
      if (!uri) return;

      if (downloadState === 'downloading') {
        return;
      }

      const mediaType: 'image' | 'video' = type === 'video' ? 'video' : 'image';

      // ─────────────────────────────────────────────
      // Case 1: Already local file → Save directly
      // ─────────────────────────────────────────────

      const isRemote = uri.startsWith('http://') || uri.startsWith('https://');

      if (!isRemote) {
        try {
          setDownloadState('downloading');
          Toast.loading('Saving to gallery…');

          await CameraRoll.save(uri, {
            type: mediaType === 'video' ? 'video' : 'photo',
          });

          setProgress(1);
          setDownloadState('done');
          Toast.success('Saved to gallery!');
          resetState();
        } catch (error) {
          console.error('[useMediaDownload] local save error:', error);
          Toast.error('Could not save to gallery.');
          setDownloadState('error');
          resetState();
        }

        return;
      }

      // ─────────────────────────────────────────────
      // Case 2: Remote file → Download then save
      // ─────────────────────────────────────────────

      const hasPermission = await ensureAndroidPermission();

      if (!hasPermission) {
        Toast.error('Storage permission needed to save media.');
        return;
      }

      setDownloadState('downloading');
      setProgress(0);
      Toast.loading('Saving to gallery…');

      const localPath = buildLocalPath(uri, mediaType);

      try {
        const { promise } = RNFS.downloadFile({
          fromUrl: uri,
          toFile: localPath,
          background: true,
          discretionary: true,
          progressDivider: 1,
          progressInterval: 100,
          progress: res => {
            const total = res.contentLength || 1;
            const pct = res.bytesWritten / total;

            setProgress(isFinite(pct) ? Math.min(Math.max(pct, 0), 1) : 0);
          },
        });

        const result = await promise;

        if (result.statusCode !== 200) {
          throw new Error(`Download failed: HTTP ${result.statusCode}`);
        }

        // IMPORTANT:
        // DO NOT add file:// here
        // CameraRoll.save(localPath) is more stable for video

        const savedUri = await CameraRoll.save(localPath, {
          type: mediaType === 'video' ? 'video' : 'photo',
        });

        console.log('Saved successfully:', savedUri);

        setProgress(1);
        setDownloadState('done');
        Toast.success('Saved to gallery!');
        resetState();
      } catch (error) {
        console.error('[useMediaDownload] download error:', error);

        Toast.error('Could not save to gallery. Please try again.');

        setDownloadState('error');
        resetState();
      } finally {
        // Cleanup temp file
        RNFS.exists(localPath)
          .then(exists => {
            if (exists) {
              RNFS.unlink(localPath).catch(() => {});
            }
          })
          .catch(() => {});
      }
    },
    [downloadState],
  );

  return {
    downloadState,
    progress,
    download,
  };
}
