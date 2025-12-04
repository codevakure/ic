/**
 * Admin Stats Card Component
 * 
 * Reusable stat card with optional trend indicator and info tooltip.
 */
import React from 'react';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { TooltipAnchor } from '@librechat/client';
import { cn } from '~/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    label?: string;
    isPositiveGood?: boolean;
  };
  icon?: React.ReactNode;
  info?: string;
  className?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}

const variantStyles = {
  default: 'bg-surface-secondary border-border-light',
  primary: 'bg-blue-500/10 border-blue-500/20',
  success: 'bg-green-500/10 border-green-500/20',
  warning: 'bg-yellow-500/10 border-yellow-500/20',
  danger: 'bg-red-500/10 border-red-500/20',
};

const iconStyles = {
  default: 'bg-surface-tertiary text-text-secondary',
  primary: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  success: 'bg-green-500/20 text-green-600 dark:text-green-400',
  warning: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
  danger: 'bg-red-500/20 text-red-600 dark:text-red-400',
};

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  icon,
  info,
  className,
  variant = 'default',
}) => {
  const getTrendColor = () => {
    if (!trend) return '';
    const isPositive = trend.value > 0;
    const isNeutral = trend.value === 0;
    
    if (isNeutral) return 'text-text-secondary';
    
    // If isPositiveGood is true (default), positive trend is green
    // If isPositiveGood is false, positive trend is red (e.g., for error rates)
    const isGood = trend.isPositiveGood !== false ? isPositive : !isPositive;
    return isGood ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  };

  const TrendIcon = trend
    ? trend.value > 0
      ? TrendingUp
      : trend.value < 0
        ? TrendingDown
        : Minus
    : null;

  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-all hover:shadow-md',
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-text-secondary">{title}</p>
            {info && (
              <TooltipAnchor
                description={info}
                side="top"
                render={
                  <button className="text-text-tertiary hover:text-text-secondary">
                    <Info className="h-3.5 w-3.5" />
                  </button>
                }
              />
            )}
          </div>
          <p className="mt-2 text-2xl font-bold text-text-primary">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {(subtitle || trend) && (
            <div className="mt-1 flex items-center gap-2">
              {trend && TrendIcon && (
                <span className={cn('flex items-center gap-1 text-xs font-medium', getTrendColor())}>
                  <TrendIcon className="h-3 w-3" />
                  {Math.abs(trend.value).toFixed(1)}%
                </span>
              )}
              {subtitle && (
                <span className="text-xs text-text-tertiary">{subtitle}</span>
              )}
              {trend?.label && (
                <span className="text-xs text-text-tertiary">{trend.label}</span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', iconStyles[variant])}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

// Mini Stats Card for inline use
interface MiniStatsCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  className?: string;
}

export const MiniStatsCard: React.FC<MiniStatsCardProps> = ({
  label,
  value,
  icon,
  className,
}) => {
  return (
    <div className={cn('flex items-center gap-3 rounded-lg bg-surface-tertiary px-3 py-2', className)}>
      {icon && <div className="text-text-secondary">{icon}</div>}
      <div>
        <p className="text-xs text-text-tertiary">{label}</p>
        <p className="font-semibold text-text-primary">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      </div>
    </div>
  );
};

// Large Stats Display
interface LargeStatsProps {
  value: string | number;
  label: string;
  sublabel?: string;
  className?: string;
}

export const LargeStats: React.FC<LargeStatsProps> = ({
  value,
  label,
  sublabel,
  className,
}) => {
  return (
    <div className={cn('text-center', className)}>
      <p className="text-4xl font-bold text-text-primary">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      <p className="mt-1 text-sm font-medium text-text-secondary">{label}</p>
      {sublabel && <p className="text-xs text-text-tertiary">{sublabel}</p>}
    </div>
  );
};
