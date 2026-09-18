module.exports = {
  dependencies: {
    // Unmaintained package: its android/build.gradle calls the removed
    // jcenter() repository, which fails on any current Gradle version and
    // blocks the whole Android build (assembleRelease and assembleDebug both).
    // Android never actually needs its native module — src/utils/keepAwake.ts
    // prefers this app's own FLAG_KEEP_SCREEN_ON native call on Android and
    // only falls back to this package on iOS, where it's excluded from here
    // and keeps working normally.
    'react-native-keep-awake': {
      platforms: {
        android: null,
      },
    },
  },
};
