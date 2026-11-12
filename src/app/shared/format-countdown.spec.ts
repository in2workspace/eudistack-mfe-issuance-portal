import { formatCountdown } from './format-countdown';

describe('formatCountdown', () => {
  it.each([
    [582, '09:42'],
    [60, '01:00'],
    [5, '00:05'],
    [0, '00:00'],
  ])('shows %i seconds as %s', (seconds, text) => {
    expect(formatCountdown(seconds)).toBe(text);
  });
});
