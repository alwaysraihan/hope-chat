const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { resolve } = require('metro-resolver');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @noble/hashes only exports `./crypto`, but some resolutions request `./crypto.js`
 * and Metro warns + falls back. Map explicitly to the export root.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    resolveRequest(context, moduleName, platform) {
      const normalized = moduleName.replace(/\\/g, '/');
      if (normalized.endsWith('@noble/hashes/crypto.js')) {
        return resolve(context, '@noble/hashes/crypto', platform);
      }
      return resolve(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
