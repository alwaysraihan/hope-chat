export * from './icons';
export * from './themes';
import IC_PROFILE from './download.jpg';
import IC_HOPENITY from './hopenity-logo.png';
// Same badge asset as Hopenity, so a verified account looks identical in both apps.
import IC_VERIFIED_BADGE from './verified_badge.png';
// Black variant for use over colored headers (e.g. the pink call header) —
// tinting the pink asset black flattened the white checkmark into the badge,
// so this is a real black/white re-render instead of a runtime tint.
import IC_VERIFIED_BADGE_BLACK from './verified_badge_black.png';

export { IC_PROFILE, IC_HOPENITY, IC_VERIFIED_BADGE, IC_VERIFIED_BADGE_BLACK };
