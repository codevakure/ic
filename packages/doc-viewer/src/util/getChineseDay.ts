/**
 * Get day of week in localized format
 */

export function getChineseDay(date: Date) {
  const day = date.getDay();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[day];
}
