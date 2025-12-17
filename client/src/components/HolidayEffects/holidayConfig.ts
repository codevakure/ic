/**
 * Holiday Configuration
 * 
 * Extensible holiday system for seasonal animations.
 * Add new holidays by defining their date ranges and effects.
 * 
 * To add a new holiday:
 * 1. Add a new entry to the HOLIDAYS array with:
 *    - id: unique identifier
 *    - name: display name
 *    - startMonth/startDay: when the holiday period starts
 *    - endMonth/endDay: when the holiday period ends
 *    - effects: array of effect types to show
 *    - colors: theme colors for the holiday
 *    - emoji: optional emoji for UI elements
 */

export type HolidayEffect = 
  | 'snow'           // Falling snowflakes
  | 'confetti'       // Colorful confetti
  | 'fireworks'      // Firework bursts
  | 'hearts'         // Floating hearts
  | 'leaves'         // Falling autumn leaves
  | 'sparkles'       // Twinkling sparkles
  | 'pumpkins'       // Halloween pumpkins
  | 'stars';         // Shooting stars

export interface HolidayConfig {
  id: string;
  name: string;
  startMonth: number;  // 1-12
  startDay: number;    // 1-31
  endMonth: number;    // 1-12
  endDay: number;      // 1-31
  effects: HolidayEffect[];
  colors: string[];
  emoji?: string;
  greeting?: string;
}

export interface Holiday extends HolidayConfig {
  isActive: boolean;
}

/**
 * Check if a date is within a range (handles year boundary for Dec-Jan)
 */
function isDateInRange(
  date: Date,
  startMonth: number,
  startDay: number,
  endMonth: number,
  endDay: number
): boolean {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  // Handle year boundary (e.g., Dec 15 - Jan 5)
  if (startMonth > endMonth) {
    // We're in Dec or Jan
    if (month === startMonth) {
      return day >= startDay;
    }
    if (month === endMonth) {
      return day <= endDay;
    }
    // Month is between (shouldn't happen for Dec-Jan range)
    return month > startMonth || month < endMonth;
  }

  // Same year range
  if (month === startMonth && month === endMonth) {
    return day >= startDay && day <= endDay;
  }
  if (month === startMonth) {
    return day >= startDay;
  }
  if (month === endMonth) {
    return day <= endDay;
  }
  return month > startMonth && month < endMonth;
}

/**
 * Check if Santa should be shown (Dec 15 - Jan 1)
 */
export function isSantaActive(): boolean {
  const now = new Date();
  return isDateInRange(now, 12, 15, 1, 1);
}

/**
 * Holiday definitions
 * Easily extensible - just add new entries here
 */
const HOLIDAYS: HolidayConfig[] = [
  {
    id: 'christmas-newyear',
    name: 'Holiday Season',
    startMonth: 12,
    startDay: 1,  // Snow starts Dec 1
    endMonth: 1,
    endDay: 5,    // Snow ends Jan 5
    effects: ['snow', 'sparkles'],
    colors: ['#ffffff', '#e8f4f8', '#c9e4f0', '#ff6b6b', '#4ecdc4', '#ffe66d'],
    emoji: '🎄',
    greeting: 'Happy Holidays! ❄️🎄✨',
  },
  {
    id: 'valentines',
    name: "Valentine's Day",
    startMonth: 2,
    startDay: 12,
    endMonth: 2,
    endDay: 15,
    effects: ['hearts', 'sparkles'],
    colors: ['#ff6b6b', '#ee5a5a', '#ff8e8e', '#ffb3b3', '#ffffff'],
    emoji: '💕',
    greeting: 'Happy Valentine\'s Day! 💕',
  },
  {
    id: 'stpatricks',
    name: "St. Patrick's Day",
    startMonth: 3,
    startDay: 15,
    endMonth: 3,
    endDay: 18,
    effects: ['confetti', 'sparkles'],
    colors: ['#2ecc71', '#27ae60', '#1abc9c', '#f1c40f', '#ffffff'],
    emoji: '🍀',
    greeting: 'Happy St. Patrick\'s Day! 🍀',
  },
  {
    id: 'easter',
    name: 'Easter',
    startMonth: 3,
    startDay: 28,
    endMonth: 4,
    endDay: 2,
    effects: ['confetti', 'sparkles'],
    colors: ['#a8e6cf', '#dcedc1', '#ffd3b6', '#ffaaa5', '#ff8b94'],
    emoji: '🐰',
    greeting: 'Happy Easter! 🐰🥚',
  },
  {
    id: 'independence',
    name: 'Independence Day',
    startMonth: 7,
    startDay: 2,
    endMonth: 7,
    endDay: 5,
    effects: ['fireworks', 'stars', 'confetti'],
    colors: ['#e74c3c', '#ffffff', '#3498db'],
    emoji: '🎆',
    greeting: 'Happy 4th of July! 🎆🇺🇸',
  },
  {
    id: 'halloween',
    name: 'Halloween',
    startMonth: 10,
    startDay: 25,
    endMonth: 11,
    endDay: 1,
    effects: ['pumpkins', 'sparkles'],
    colors: ['#f39c12', '#e67e22', '#9b59b6', '#2c3e50', '#1abc9c'],
    emoji: '🎃',
    greeting: 'Happy Halloween! 🎃👻',
  },
  {
    id: 'thanksgiving',
    name: 'Thanksgiving',
    startMonth: 11,
    startDay: 20,
    endMonth: 11,
    endDay: 29,
    effects: ['leaves', 'sparkles'],
    colors: ['#d35400', '#e67e22', '#f39c12', '#c0392b', '#8e44ad'],
    emoji: '🦃',
    greeting: 'Happy Thanksgiving! 🦃🍂',
  },
  {
    id: 'diwali',
    name: 'Diwali',
    startMonth: 10,
    startDay: 28,
    endMonth: 11,
    endDay: 3,
    effects: ['fireworks', 'sparkles', 'stars'],
    colors: ['#f1c40f', '#e67e22', '#e74c3c', '#9b59b6', '#ffffff'],
    emoji: '🪔',
    greeting: 'Happy Diwali! 🪔✨',
  },
  {
    id: 'newyear',
    name: 'New Year',
    startMonth: 12,
    startDay: 30,
    endMonth: 1,
    endDay: 2,
    effects: ['fireworks', 'confetti', 'sparkles'],
    colors: ['#f1c40f', '#e74c3c', '#3498db', '#9b59b6', '#ffffff'],
    emoji: '🎉',
    greeting: 'Happy New Year! 🎉🥳',
  },
];

/**
 * Get the currently active holiday, if any
 * Returns null if no holiday is active
 */
export function getActiveHoliday(date: Date = new Date()): Holiday | null {
  for (const holiday of HOLIDAYS) {
    if (isDateInRange(date, holiday.startMonth, holiday.startDay, holiday.endMonth, holiday.endDay)) {
      return { ...holiday, isActive: true };
    }
  }
  return null;
}

/**
 * Get all configured holidays
 */
export function getAllHolidays(): HolidayConfig[] {
  return [...HOLIDAYS];
}

/**
 * Check if a specific holiday is active
 */
export function isHolidayActive(holidayId: string, date: Date = new Date()): boolean {
  const holiday = HOLIDAYS.find(h => h.id === holidayId);
  if (!holiday) return false;
  return isDateInRange(date, holiday.startMonth, holiday.startDay, holiday.endMonth, holiday.endDay);
}
