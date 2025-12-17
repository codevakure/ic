/**
 * Admin Date Range Picker Component
 * 
 * Unified date range selector used across all admin pages.
 * Matches the Dashboard's clean design with preset buttons.
 */
import { useState, useMemo, useCallback } from 'react';
import { Calendar, RefreshCw } from 'lucide-react';
import { cn } from '~/utils';

// Date range presets - in incremental order
const DATE_PRESETS = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'This Month', value: 'month' },
] as const;

type DatePreset = (typeof DATE_PRESETS)[number]['value'];

interface DateRange {
  startDate: string;
  endDate: string;
}

interface AdminDateRangePickerProps {
  startDate: string;
  endDate: string;
  onDateChange: (range: DateRange) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  className?: string;
}

// Format date for input (YYYY-MM-DD) - using local time consistently
const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Get preset value from dates
const getPresetFromDates = (startDate: string, endDate: string): DatePreset | null => {
  const now = new Date();
  const today = formatDateForInput(now);
  
  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDateForInput(yesterday);
  
  // Month start
  const monthStart = formatDateForInput(new Date(now.getFullYear(), now.getMonth(), 1));
  
  // 7 days ago
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 6); // Include today = 7 days total
  const weekAgoStr = formatDateForInput(weekAgo);
  
  // 30 days ago
  const monthAgo = new Date(now);
  monthAgo.setDate(monthAgo.getDate() - 29); // Include today = 30 days total
  const monthAgoStr = formatDateForInput(monthAgo);

  if (startDate === today && endDate === today) return 'today';
  if (startDate === yesterdayStr && endDate === yesterdayStr) return 'yesterday';
  if (startDate === weekAgoStr && endDate === today) return '7d';
  if (startDate === monthAgoStr && endDate === today) return '30d';
  if (startDate === monthStart && endDate === today) return 'month';
  return null;
};

export function AdminDateRangePicker({
  startDate,
  endDate,
  onDateChange,
  onRefresh,
  isLoading = false,
  className,
}: AdminDateRangePickerProps) {
  const [showCustomDates, setShowCustomDates] = useState(false);

  // Determine active preset
  const activePreset = useMemo(() => getPresetFromDates(startDate, endDate), [startDate, endDate]);

  // Handle preset click
  const handlePresetClick = useCallback((preset: DatePreset) => {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (preset) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'yesterday':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        break;
      case '7d':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6); // 7 days including today
        break;
      case '30d':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29); // 30 days including today
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        start = now;
    }

    setShowCustomDates(false);
    onDateChange({
      startDate: formatDateForInput(start),
      endDate: formatDateForInput(end),
    });
  }, [onDateChange]);

  // Toggle custom date picker
  const handleCustomClick = useCallback(() => {
    setShowCustomDates(prev => !prev);
  }, []);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Custom date inputs - shown when clicking the date display */}
      {showCustomDates && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => onDateChange({ startDate: e.target.value, endDate })}
            className="rounded-md border border-border-light bg-surface-primary px-2 py-1 text-xs text-text-primary focus:border-[var(--surface-submit)] focus:outline-none"
          />
          <span className="text-xs text-text-tertiary">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onDateChange({ startDate, endDate: e.target.value })}
            className="rounded-md border border-border-light bg-surface-primary px-2 py-1 text-xs text-text-primary focus:border-[var(--surface-submit)] focus:outline-none"
          />
        </div>
      )}

      {/* Date Range Selector - pill button group */}
      <div className="flex items-center gap-1 rounded-lg border border-border-light bg-surface-secondary p-1">
        {/* Calendar icon - click to show/hide custom dates */}
        <button
          onClick={handleCustomClick}
          className={cn(
            'ml-1 flex items-center justify-center rounded p-1.5 transition-colors',
            showCustomDates
              ? 'bg-surface-submit text-white'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
          )}
          title={showCustomDates ? 'Hide custom dates' : 'Show custom dates'}
        >
          <Calendar className="h-4 w-4" />
        </button>

        {/* Preset buttons */}
        {DATE_PRESETS.map(preset => (
          <button
            key={preset.value}
            onClick={() => handlePresetClick(preset.value)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              activePreset === preset.value
                ? 'bg-surface-submit text-white'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Refresh button */}
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center justify-center rounded-lg border border-border-light bg-surface-submit p-2 text-white transition-colors hover:opacity-90 disabled:opacity-50"
          title="Refresh data"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
        </button>
      )}
    </div>
  );
}

export default AdminDateRangePicker;
