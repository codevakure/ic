/**
 * @ranger/triggers - Cron Parser Utilities
 *
 * Utilities for working with cron expressions.
 * Converts intervals to cron, validates expressions, and calculates next runs.
 *
 * ## Cron Expression Format:
 * ```
 * ┌────────────── second (0-59) [optional, node-cron specific]
 * │ ┌──────────── minute (0-59)
 * │ │ ┌────────── hour (0-23)
 * │ │ │ ┌──────── day of month (1-31)
 * │ │ │ │ ┌────── month (1-12)
 * │ │ │ │ │ ┌──── day of week (0-7, 0 or 7 is Sunday)
 * │ │ │ │ │ │
 * * * * * * *
 * ```
 *
 * ## Special Characters:
 * - `*` any value
 * - `,` value list separator (1,3,5)
 * - `-` range of values (1-5)
 * - `/` step values (e.g. every 15)
 *
 * @packageDocumentation
 */

import cron from 'node-cron';
import type { IntervalSchedule, IntervalUnit } from '../types';

/**
 * Convert an interval configuration to a cron expression.
 *
 * @param interval - Interval configuration
 * @returns Cron expression string
 *
 * @example
 * // Every 5 minutes returns: star/5 star star star star
 * intervalToCron({ mode: 'interval', value: 5, unit: 'minutes' })
 *
 * // Every 2 hours returns: 0 star/2 star star star
 * intervalToCron({ mode: 'interval', value: 2, unit: 'hours' })
 */
export function intervalToCron(interval: IntervalSchedule): string {
  const { value, unit } = interval;

  switch (unit) {
    case 'seconds':
      // node-cron supports 6-field expressions with seconds
      if (value === 1) {
        return '* * * * * *'; // Every second
      }
      return `*/${value} * * * * *`; // Every N seconds

    case 'minutes':
      if (value === 1) {
        return '* * * * *'; // Every minute
      }
      return `*/${value} * * * *`; // Every N minutes

    case 'hours':
      if (value === 1) {
        return '0 * * * *'; // Every hour on the hour
      }
      return `0 */${value} * * *`; // Every N hours

    case 'days':
      if (value === 1) {
        return '0 0 * * *'; // Every day at midnight
      }
      // For multiple days, we need to calculate specific days
      // Since cron doesn't support "every N days" directly, we use day of month
      return `0 0 */${value} * *`; // Every N days (approximate)

    case 'weeks':
      // Every N weeks on Sunday at midnight
      // Note: Cron doesn't directly support "every N weeks"
      // This runs every Sunday; for N weeks, external tracking needed
      return '0 0 * * 0'; // Weekly on Sunday

    default:
      throw new Error(`Unsupported interval unit: ${unit}`);
  }
}

/**
 * Validate a cron expression.
 *
 * @param expression - Cron expression to validate
 * @returns true if valid
 *
 * @example
 * isValidCronExpression('0 9 * * 1-5') // true
 * isValidCronExpression('invalid')      // false
 */
export function isValidCronExpression(expression: string): boolean {
  return cron.validate(expression);
}

/**
 * Get the next scheduled date for a cron expression.
 * Uses a simple calculation approach.
 *
 * @param expression - Cron expression
 * @param timezone - Optional timezone
 * @returns Next run date or null
 *
 * ## Production Note:
 * For more accurate next-run calculation, consider using:
 * - cron-parser package (more features)
 * - Later.js (human-readable schedules)
 * - BullMQ (built-in next run tracking)
 */
export function getNextCronDate(expression: string, timezone?: string): Date | null {
  if (!isValidCronExpression(expression)) {
    return null;
  }

  // Parse the cron expression to calculate next run
  const now = new Date();
  const parts = expression.split(' ');

  // Handle both 5-field and 6-field (with seconds) expressions
  const hasSeconds = parts.length === 6;
  const [
    secondsOrMinutes,
    minutesOrHours,
    hoursOrDayOfMonth,
    dayOfMonthOrMonth,
    monthOrDayOfWeek,
    dayOfWeekOptional,
  ] = parts;

  const seconds = hasSeconds ? secondsOrMinutes : '0';
  const minutes = hasSeconds ? minutesOrHours : secondsOrMinutes;
  const hours = hasSeconds ? hoursOrDayOfMonth : minutesOrHours;

  // Simple next-minute calculation for common cases
  const nextRun = new Date(now);

  // Handle simple interval patterns
  if (minutes === '*') {
    // Every minute
    nextRun.setSeconds(0, 0);
    nextRun.setMinutes(nextRun.getMinutes() + 1);
  } else if (minutes.startsWith('*/')) {
    // Every N minutes
    const interval = parseInt(minutes.slice(2), 10);
    const currentMinute = now.getMinutes();
    const nextMinute = Math.ceil((currentMinute + 1) / interval) * interval;

    nextRun.setSeconds(0, 0);
    if (nextMinute >= 60) {
      nextRun.setHours(nextRun.getHours() + 1);
      nextRun.setMinutes(nextMinute % 60);
    } else {
      nextRun.setMinutes(nextMinute);
    }
  } else if (/^\d+$/.test(minutes)) {
    // Specific minute
    const targetMinute = parseInt(minutes, 10);
    nextRun.setSeconds(0, 0);

    if (hours === '*' || hours.startsWith('*/')) {
      // Runs every hour at specific minute
      if (now.getMinutes() >= targetMinute) {
        nextRun.setHours(nextRun.getHours() + 1);
      }
      nextRun.setMinutes(targetMinute);
    } else if (/^\d+$/.test(hours)) {
      // Specific hour and minute
      const targetHour = parseInt(hours, 10);
      nextRun.setMinutes(targetMinute);
      nextRun.setHours(targetHour);

      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
    }
  } else {
    // Complex expression - add 1 minute as approximation
    nextRun.setSeconds(0, 0);
    nextRun.setMinutes(nextRun.getMinutes() + 1);
  }

  return nextRun;
}

/**
 * Parse a human-readable interval string to IntervalSchedule.
 *
 * @param input - Human-readable string like "every 5 minutes"
 * @returns IntervalSchedule or null if not parseable
 *
 * @example
 * parseHumanInterval('every 5 minutes')
 * // Returns: { mode: 'interval', value: 5, unit: 'minutes' }
 *
 * parseHumanInterval('every hour')
 * // Returns: { mode: 'interval', value: 1, unit: 'hours' }
 */
export function parseHumanInterval(input: string): IntervalSchedule | null {
  const normalized = input.toLowerCase().trim();

  // Patterns to match
  const patterns: Array<{ regex: RegExp; unit: IntervalUnit; defaultValue?: number }> = [
    // "every 5 minutes", "every 30 seconds"
    { regex: /^every\s+(\d+)\s+(second|minute|hour|day|week)s?$/, unit: 'minutes' },
    // "every minute", "every hour"
    { regex: /^every\s+(second|minute|hour|day|week)$/, unit: 'minutes', defaultValue: 1 },
    // "5 minutes", "30 seconds"
    { regex: /^(\d+)\s+(second|minute|hour|day|week)s?$/, unit: 'minutes' },
    // "hourly", "daily", "weekly"
    { regex: /^(hourly|daily|weekly)$/, unit: 'hours' },
  ];

  // Try each pattern
  for (const pattern of patterns) {
    const match = normalized.match(pattern.regex);
    if (match) {
      // Handle special cases
      if (['hourly', 'daily', 'weekly'].includes(match[1])) {
        const mapping: Record<string, IntervalSchedule> = {
          hourly: { mode: 'interval', value: 1, unit: 'hours' },
          daily: { mode: 'interval', value: 1, unit: 'days' },
          weekly: { mode: 'interval', value: 1, unit: 'weeks' },
        };
        return mapping[match[1]];
      }

      // Extract value and unit
      let value: number;
      let unitStr: string;

      if (pattern.defaultValue !== undefined) {
        // "every minute" style
        value = pattern.defaultValue;
        unitStr = match[1];
      } else {
        // "every 5 minutes" style
        value = parseInt(match[1], 10);
        unitStr = match[2];
      }

      // Normalize unit to plural form
      const unitMap: Record<string, IntervalUnit> = {
        second: 'seconds',
        seconds: 'seconds',
        minute: 'minutes',
        minutes: 'minutes',
        hour: 'hours',
        hours: 'hours',
        day: 'days',
        days: 'days',
        week: 'weeks',
        weeks: 'weeks',
      };

      const unit = unitMap[unitStr];
      if (unit) {
        return { mode: 'interval', value, unit };
      }
    }
  }

  return null;
}

/**
 * Format an interval or cron schedule as human-readable text.
 *
 * @param schedule - Schedule configuration
 * @returns Human-readable description
 *
 * @example
 * formatSchedule({ mode: 'interval', value: 5, unit: 'minutes' })
 * // Returns: "Every 5 minutes"
 *
 * formatSchedule({ mode: 'cron', expression: '0 9 * * 1-5' })
 * // Returns: "At 9:00 AM on weekdays"
 */
export function formatSchedule(
  schedule: IntervalSchedule | { mode: 'cron'; expression: string }
): string {
  if (schedule.mode === 'interval') {
    const { value, unit } = schedule;
    if (value === 1) {
      // Singular form
      const singular = unit.slice(0, -1); // Remove 's'
      return `Every ${singular}`;
    }
    return `Every ${value} ${unit}`;
  }

  // Cron expression - provide common translations
  const cronDescriptions: Record<string, string> = {
    '* * * * *': 'Every minute',
    '*/5 * * * *': 'Every 5 minutes',
    '*/15 * * * *': 'Every 15 minutes',
    '*/30 * * * *': 'Every 30 minutes',
    '0 * * * *': 'Every hour',
    '0 */2 * * *': 'Every 2 hours',
    '0 */6 * * *': 'Every 6 hours',
    '0 */12 * * *': 'Every 12 hours',
    '0 0 * * *': 'Daily at midnight',
    '0 9 * * *': 'Daily at 9:00 AM',
    '0 18 * * *': 'Daily at 6:00 PM',
    '0 9 * * 1-5': 'Weekdays at 9:00 AM',
    '0 18 * * 1-5': 'Weekdays at 6:00 PM',
    '0 10 * * 0,6': 'Weekends at 10:00 AM',
    '0 9 * * 1': 'Every Monday at 9:00 AM',
    '0 17 * * 5': 'Every Friday at 5:00 PM',
    '0 9 1 * *': 'First of month at 9:00 AM',
  };

  return cronDescriptions[schedule.expression] ?? `Cron: ${schedule.expression}`;
}

/**
 * Calculate the interval in milliseconds for a schedule.
 *
 * @param schedule - Schedule configuration
 * @returns Interval in milliseconds (approximate for cron)
 */
export function getIntervalMs(schedule: IntervalSchedule): number {
  const { value, unit } = schedule;

  const multipliers: Record<IntervalUnit, number> = {
    seconds: 1000,
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
}
