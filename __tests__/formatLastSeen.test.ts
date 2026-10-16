import { formatClock12h, formatLastSeenLine } from '../src/utils/formatLastSeen';

describe('12-hour clock', () => {
  it('formats with AM/PM', () => {
    expect(formatClock12h(new Date(2026, 9, 16, 14, 5))).toBe('2:05 PM');
    expect(formatClock12h(new Date(2026, 9, 16, 0, 30))).toBe('12:30 AM');
  });

  it('uses it for last seen earlier today', () => {
    const now = new Date();
    if (now.getHours() < 2) return; // "earlier today" needs room before now
    const earlier = new Date(now.getTime() - 90 * 60 * 1000);
    expect(formatLastSeenLine(earlier.getTime())).toMatch(
      /^last seen today at \d{1,2}:\d{2} (AM|PM)$/,
    );
  });
});
