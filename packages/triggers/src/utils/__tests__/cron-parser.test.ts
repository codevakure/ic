/**
 * @librechat/triggers - Cron Parser Tests
 *
 * Tests for cron expression utilities.
 */

import {
  intervalToCron,
  isValidCronExpression,
  parseHumanInterval,
  formatSchedule,
  getIntervalMs,
} from '../cron-parser';
import type { IntervalSchedule } from '../../types';

describe('cron-parser utilities', () => {
  describe('intervalToCron', () => {
    it('should convert seconds intervals', () => {
      expect(intervalToCron({ mode: 'interval', value: 1, unit: 'seconds' })).toBe('* * * * * *');
      expect(intervalToCron({ mode: 'interval', value: 30, unit: 'seconds' })).toBe('*/30 * * * * *');
    });

    it('should convert minute intervals', () => {
      expect(intervalToCron({ mode: 'interval', value: 1, unit: 'minutes' })).toBe('* * * * *');
      expect(intervalToCron({ mode: 'interval', value: 5, unit: 'minutes' })).toBe('*/5 * * * *');
      expect(intervalToCron({ mode: 'interval', value: 15, unit: 'minutes' })).toBe('*/15 * * * *');
      expect(intervalToCron({ mode: 'interval', value: 30, unit: 'minutes' })).toBe('*/30 * * * *');
    });

    it('should convert hour intervals', () => {
      expect(intervalToCron({ mode: 'interval', value: 1, unit: 'hours' })).toBe('0 * * * *');
      expect(intervalToCron({ mode: 'interval', value: 2, unit: 'hours' })).toBe('0 */2 * * *');
      expect(intervalToCron({ mode: 'interval', value: 6, unit: 'hours' })).toBe('0 */6 * * *');
      expect(intervalToCron({ mode: 'interval', value: 12, unit: 'hours' })).toBe('0 */12 * * *');
    });

    it('should convert day intervals', () => {
      expect(intervalToCron({ mode: 'interval', value: 1, unit: 'days' })).toBe('0 0 * * *');
      expect(intervalToCron({ mode: 'interval', value: 2, unit: 'days' })).toBe('0 0 */2 * *');
    });

    it('should convert week intervals', () => {
      expect(intervalToCron({ mode: 'interval', value: 1, unit: 'weeks' })).toBe('0 0 * * 0');
    });

    it('should throw for unsupported units', () => {
      expect(() =>
        intervalToCron({ mode: 'interval', value: 1, unit: 'months' as any })
      ).toThrow('Unsupported interval unit');
    });
  });

  describe('isValidCronExpression', () => {
    it('should validate correct 5-field expressions', () => {
      expect(isValidCronExpression('* * * * *')).toBe(true);
      expect(isValidCronExpression('0 9 * * *')).toBe(true);
      expect(isValidCronExpression('0 9 * * 1-5')).toBe(true);
      expect(isValidCronExpression('*/15 * * * *')).toBe(true);
      expect(isValidCronExpression('0,30 * * * *')).toBe(true);
    });

    it('should validate correct 6-field expressions (with seconds)', () => {
      expect(isValidCronExpression('* * * * * *')).toBe(true);
      expect(isValidCronExpression('*/30 * * * * *')).toBe(true);
    });

    it('should reject invalid expressions', () => {
      expect(isValidCronExpression('invalid')).toBe(false);
      expect(isValidCronExpression('')).toBe(false);
      expect(isValidCronExpression('* * *')).toBe(false);
      expect(isValidCronExpression('60 * * * *')).toBe(false);
      expect(isValidCronExpression('* 25 * * *')).toBe(false);
    });
  });

  describe('parseHumanInterval', () => {
    it('should parse "every N unit" patterns', () => {
      expect(parseHumanInterval('every 5 minutes')).toEqual({
        mode: 'interval',
        value: 5,
        unit: 'minutes',
      });
      expect(parseHumanInterval('every 2 hours')).toEqual({
        mode: 'interval',
        value: 2,
        unit: 'hours',
      });
      expect(parseHumanInterval('every 30 seconds')).toEqual({
        mode: 'interval',
        value: 30,
        unit: 'seconds',
      });
    });

    it('should parse "every unit" patterns (singular)', () => {
      expect(parseHumanInterval('every minute')).toEqual({
        mode: 'interval',
        value: 1,
        unit: 'minutes',
      });
      expect(parseHumanInterval('every hour')).toEqual({
        mode: 'interval',
        value: 1,
        unit: 'hours',
      });
      expect(parseHumanInterval('every day')).toEqual({
        mode: 'interval',
        value: 1,
        unit: 'days',
      });
    });

    it('should parse shorthand patterns', () => {
      expect(parseHumanInterval('hourly')).toEqual({
        mode: 'interval',
        value: 1,
        unit: 'hours',
      });
      expect(parseHumanInterval('daily')).toEqual({
        mode: 'interval',
        value: 1,
        unit: 'days',
      });
      expect(parseHumanInterval('weekly')).toEqual({
        mode: 'interval',
        value: 1,
        unit: 'weeks',
      });
    });

    it('should be case-insensitive', () => {
      expect(parseHumanInterval('Every 5 Minutes')).toEqual({
        mode: 'interval',
        value: 5,
        unit: 'minutes',
      });
      expect(parseHumanInterval('HOURLY')).toEqual({
        mode: 'interval',
        value: 1,
        unit: 'hours',
      });
    });

    it('should return null for unparseable strings', () => {
      expect(parseHumanInterval('invalid')).toBeNull();
      expect(parseHumanInterval('at 9am')).toBeNull();
      expect(parseHumanInterval('every fortnight')).toBeNull();
    });
  });

  describe('formatSchedule', () => {
    it('should format interval schedules', () => {
      expect(formatSchedule({ mode: 'interval', value: 1, unit: 'minutes' })).toBe('Every minute');
      expect(formatSchedule({ mode: 'interval', value: 5, unit: 'minutes' })).toBe('Every 5 minutes');
      expect(formatSchedule({ mode: 'interval', value: 1, unit: 'hours' })).toBe('Every hour');
      expect(formatSchedule({ mode: 'interval', value: 2, unit: 'hours' })).toBe('Every 2 hours');
    });

    it('should format known cron expressions', () => {
      expect(formatSchedule({ mode: 'cron', expression: '* * * * *' })).toBe('Every minute');
      expect(formatSchedule({ mode: 'cron', expression: '0 9 * * *' })).toBe('Daily at 9:00 AM');
      expect(formatSchedule({ mode: 'cron', expression: '0 9 * * 1-5' })).toBe('Weekdays at 9:00 AM');
    });

    it('should show raw expression for unknown cron patterns', () => {
      expect(formatSchedule({ mode: 'cron', expression: '0 9 15 * *' })).toBe('Cron: 0 9 15 * *');
    });
  });

  describe('getIntervalMs', () => {
    it('should calculate correct milliseconds for seconds', () => {
      expect(getIntervalMs({ mode: 'interval', value: 1, unit: 'seconds' })).toBe(1000);
      expect(getIntervalMs({ mode: 'interval', value: 30, unit: 'seconds' })).toBe(30000);
    });

    it('should calculate correct milliseconds for minutes', () => {
      expect(getIntervalMs({ mode: 'interval', value: 1, unit: 'minutes' })).toBe(60000);
      expect(getIntervalMs({ mode: 'interval', value: 5, unit: 'minutes' })).toBe(300000);
    });

    it('should calculate correct milliseconds for hours', () => {
      expect(getIntervalMs({ mode: 'interval', value: 1, unit: 'hours' })).toBe(3600000);
      expect(getIntervalMs({ mode: 'interval', value: 24, unit: 'hours' })).toBe(86400000);
    });

    it('should calculate correct milliseconds for days', () => {
      expect(getIntervalMs({ mode: 'interval', value: 1, unit: 'days' })).toBe(86400000);
      expect(getIntervalMs({ mode: 'interval', value: 7, unit: 'days' })).toBe(604800000);
    });

    it('should calculate correct milliseconds for weeks', () => {
      expect(getIntervalMs({ mode: 'interval', value: 1, unit: 'weeks' })).toBe(604800000);
      expect(getIntervalMs({ mode: 'interval', value: 2, unit: 'weeks' })).toBe(1209600000);
    });
  });
});
