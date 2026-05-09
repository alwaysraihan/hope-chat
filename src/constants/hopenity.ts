/** Android Play / package id for sibling Hopenity app. */
export const HOPENITY_PACKAGE_ID = 'com.hopenity';

/** iOS — add this scheme under URL Types in Hopenity if you deep-link SSO. */
export const HOPENITY_IOS_SCHEME = 'hopenity://';

/** App Group identifier — must match iOS entitlements on both Hope Chat and Hopenity. */
export const HOPENITY_APP_GROUP = 'group.com.hopenity.shared';

export const PLAY_STORE_MARKET_URL = `market://details?id=${HOPENITY_PACKAGE_ID}`;
export const PLAY_STORE_WEB_URL = `https://play.google.com/store/apps/details?id=${HOPENITY_PACKAGE_ID}`;
