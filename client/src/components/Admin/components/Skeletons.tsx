/**
 * Admin Skeleton Components
 * 
 * Reusable skeleton loading states for admin pages to provide
 * better visual feedback during data loading.
 */
import React from 'react';
import { Skeleton } from '@ranger/client';
import { cn } from '~/utils';

// Base skeleton card for stats/metrics
interface StatCardSkeletonProps {
  className?: string;
  size?: 'default' | 'large';
}

export const StatCardSkeleton: React.FC<StatCardSkeletonProps> = ({ 
  className, 
  size = 'default' 
}) => (
  <div className={cn(
    'rounded-xl border border-border-light bg-surface-secondary p-4',
    className
  )}>
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <Skeleton className={cn(
          'mb-2 rounded',
          size === 'large' ? 'h-4 w-20' : 'h-3 w-16'
        )} />
        <Skeleton className={cn(
          'mb-2 rounded',
          size === 'large' ? 'h-8 w-24' : 'h-6 w-20'
        )} />
        <Skeleton className="h-3 w-16 rounded" />
      </div>
      <Skeleton className={cn(
        'rounded-lg',
        size === 'large' ? 'h-11 w-11' : 'h-9 w-9'
      )} />
    </div>
  </div>
);

// Skeleton for stats grid (4 cards)
interface StatsGridSkeletonProps {
  count?: number;
  className?: string;
}

export const StatsGridSkeleton: React.FC<StatsGridSkeletonProps> = ({ 
  count = 4, 
  className 
}) => (
  <div className={cn('grid gap-3 grid-cols-2 lg:grid-cols-4', className)}>
    {Array.from({ length: count }).map((_, i) => (
      <StatCardSkeleton key={i} />
    ))}
  </div>
);

// Skeleton for chart panels
interface ChartSkeletonProps {
  height?: number;
  title?: boolean;
  className?: string;
}

export const ChartSkeleton: React.FC<ChartSkeletonProps> = ({ 
  height = 200, 
  title = true,
  className 
}) => (
  <div className={cn(
    'rounded-xl border border-border-light bg-surface-secondary p-5',
    className
  )}>
    {title && (
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Skeleton className="h-5 w-32 rounded mb-1" />
          <Skeleton className="h-3 w-48 rounded" />
        </div>
        <Skeleton className="h-4 w-4 rounded" />
      </div>
    )}
    <Skeleton 
      className="w-full rounded" 
      style={{ height: `${height}px` }} 
    />
  </div>
);

// Skeleton for table rows
interface TableRowSkeletonProps {
  columns?: number;
  className?: string;
}

export const TableRowSkeleton: React.FC<TableRowSkeletonProps> = ({ 
  columns = 6,
  className 
}) => (
  <div className={cn(
    'grid gap-4 items-center px-3 py-3 border-b border-border-light/50',
    className
  )} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
    {Array.from({ length: columns }).map((_, i) => (
      <Skeleton 
        key={i} 
        className={cn(
          'h-4 rounded',
          i === 0 ? 'w-32' : 'w-16'
        )} 
      />
    ))}
  </div>
);

// Skeleton for full table
interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  className?: string;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ 
  rows = 5, 
  columns = 6,
  showHeader = true,
  className 
}) => (
  <div className={cn(
    'rounded-lg border border-border-light bg-surface-primary overflow-hidden',
    className
  )}>
    {showHeader && (
      <div className="px-3 py-2 border-b border-border-light bg-surface-secondary">
        <div 
          className="grid gap-4" 
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-16 rounded" />
          ))}
        </div>
      </div>
    )}
    <div className="divide-y divide-border-light/50">
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} columns={columns} />
      ))}
    </div>
  </div>
);

// Skeleton for trace rows specifically
export const TraceRowSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn(
    'px-3 py-2 grid grid-cols-12 gap-3 items-center border-b border-border-light/50',
    className
  )}>
    {/* User column */}
    <div className="col-span-2 flex items-center gap-2">
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <Skeleton className="h-4 w-20 rounded mb-1" />
        <Skeleton className="h-3 w-24 rounded" />
      </div>
    </div>
    {/* Conversation column */}
    <div className="col-span-2">
      <Skeleton className="h-4 w-24 rounded mb-1" />
      <Skeleton className="h-3 w-20 rounded" />
    </div>
    {/* Input/Output column */}
    <div className="col-span-3">
      <Skeleton className="h-3 w-full rounded mb-2" />
      <Skeleton className="h-3 w-3/4 rounded" />
    </div>
    {/* Model column */}
    <div className="col-span-1 flex justify-center">
      <Skeleton className="h-5 w-16 rounded" />
    </div>
    {/* Tokens column */}
    <div className="col-span-1 flex flex-col items-end">
      <Skeleton className="h-4 w-12 rounded mb-1" />
      <Skeleton className="h-3 w-16 rounded" />
    </div>
    {/* Cost column */}
    <div className="col-span-1 flex flex-col items-end">
      <Skeleton className="h-4 w-14 rounded mb-1" />
      <Skeleton className="h-3 w-16 rounded" />
    </div>
    {/* Flags column */}
    <div className="col-span-1">
      <Skeleton className="h-5 w-8 rounded" />
    </div>
    {/* Time column */}
    <div className="col-span-1 flex flex-col items-end">
      <Skeleton className="h-4 w-16 rounded mb-1" />
      <Skeleton className="h-3 w-14 rounded" />
    </div>
  </div>
);

// Skeleton for traces table
interface TracesTableSkeletonProps {
  rows?: number;
  className?: string;
}

export const TracesTableSkeleton: React.FC<TracesTableSkeletonProps> = ({ 
  rows = 10,
  className 
}) => (
  <div className={cn(
    'rounded-lg border border-border-light bg-surface-primary overflow-hidden',
    className
  )}>
    {/* Header */}
    <div className="px-3 py-2 border-b border-border-light bg-surface-secondary min-w-[900px]">
      <div className="grid grid-cols-12 gap-4">
        <Skeleton className="col-span-2 h-3 w-12 rounded" />
        <Skeleton className="col-span-2 h-3 w-20 rounded" />
        <Skeleton className="col-span-3 h-3 w-24 rounded" />
        <Skeleton className="col-span-1 h-3 w-12 rounded" />
        <Skeleton className="col-span-1 h-3 w-12 rounded" />
        <Skeleton className="col-span-1 h-3 w-10 rounded" />
        <Skeleton className="col-span-1 h-3 w-10 rounded" />
        <Skeleton className="col-span-1 h-3 w-10 rounded" />
      </div>
    </div>
    {/* Rows */}
    <div className="min-w-[900px]">
      {Array.from({ length: rows }).map((_, i) => (
        <TraceRowSkeleton key={i} />
      ))}
    </div>
  </div>
);

// Skeleton for filter bar
export const FilterBarSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn(
    'rounded-lg border border-border-light bg-surface-primary p-3',
    className
  )}>
    <div className="flex flex-col gap-3">
      <div className="flex flex-col md:flex-row gap-3">
        <Skeleton className="flex-1 h-10 rounded-lg" />
        <Skeleton className="h-10 w-44 rounded-lg" />
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>
      <div className="flex flex-col md:flex-row gap-3">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>
    </div>
  </div>
);

// Dashboard-specific skeleton for the main activity chart section
export const DashboardActivitySkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('grid gap-5 grid-cols-1 lg:grid-cols-12', className)}>
    {/* Activity Chart - 8 columns */}
    <div className="lg:col-span-8 rounded-xl border border-border-light bg-surface-secondary p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Skeleton className="h-5 w-28 rounded mb-1" />
          <Skeleton className="h-3 w-48 rounded" />
        </div>
        <Skeleton className="h-6 w-16 rounded-lg" />
      </div>
      <Skeleton className="h-[220px] w-full rounded" />
    </div>
    {/* 4 Key Metrics - 4 columns (2x2 grid) */}
    <div className="lg:col-span-4 grid gap-3 grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <StatCardSkeleton key={i} size="large" />
      ))}
    </div>
  </div>
);

// Dashboard full page skeleton
export const DashboardPageSkeleton: React.FC = () => (
  <div className="space-y-5 p-4 md:p-6 animate-pulse">
    {/* Header */}
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <Skeleton className="h-8 w-32 rounded mb-2" />
        <Skeleton className="h-4 w-48 rounded" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-80 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>
    </div>
    
    {/* Row 1: Activity + Metrics */}
    <DashboardActivitySkeleton />
    
    {/* Row 2: 4 Metric Cards */}
    <StatsGridSkeleton count={4} />
    
    {/* Row 3: Two charts */}
    <div className="grid gap-5 lg:grid-cols-2">
      <ChartSkeleton height={200} />
      <ChartSkeleton height={200} />
    </div>
    
    {/* Row 4: Two more charts */}
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartSkeleton height={160} />
      <ChartSkeleton height={160} />
    </div>
    
    {/* Row 5: Two charts */}
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartSkeleton height={160} />
      <ChartSkeleton height={160} />
    </div>
  </div>
);

// Traces page skeleton
export const TracesPageSkeleton: React.FC = () => (
  <div className="space-y-4 p-4 md:p-5 animate-pulse">
    {/* Header */}
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div>
        <Skeleton className="h-7 w-40 rounded mb-2" />
        <Skeleton className="h-4 w-72 rounded" />
      </div>
      <Skeleton className="h-10 w-24 rounded-lg" />
    </div>
    
    {/* Summary Stats */}
    <StatsGridSkeleton count={4} />
    
    {/* Filters */}
    <FilterBarSkeleton />
    
    {/* Traces Table */}
    <TracesTableSkeleton rows={10} />
    
    {/* Pagination */}
    <div className="flex items-center justify-between">
      <Skeleton className="h-4 w-48 rounded" />
      <div className="flex gap-2">
        <Skeleton className="h-10 w-24 rounded-lg" />
        <Skeleton className="h-10 w-24 rounded-lg" />
      </div>
    </div>
  </div>
);

// Agents page skeleton
export const AgentsPageSkeleton: React.FC = () => (
  <div className="space-y-4 p-4 md:p-6 animate-pulse">
    {/* Header */}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Skeleton className="h-7 w-24 rounded mb-2" />
        <Skeleton className="h-4 w-56 rounded" />
      </div>
      <Skeleton className="h-9 w-24 rounded-lg" />
    </div>
    
    {/* Date Filters */}
    <div className="rounded-lg border border-border-light bg-surface-secondary p-3">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-4 w-16 rounded" />
        <Skeleton className="h-8 w-32 rounded" />
        <Skeleton className="h-4 w-6 rounded" />
        <Skeleton className="h-8 w-32 rounded" />
        <div className="flex gap-1">
          <Skeleton className="h-7 w-20 rounded" />
          <Skeleton className="h-7 w-16 rounded" />
          <Skeleton className="h-7 w-24 rounded" />
        </div>
      </div>
    </div>
    
    {/* Stats Cards */}
    <StatsGridSkeleton count={4} />
    
    {/* Table */}
    <TableSkeleton rows={8} columns={6} />
  </div>
);

// Costs page skeleton
export const CostsPageSkeleton: React.FC = () => (
  <div className="space-y-4 p-4 md:p-6 animate-pulse">
    {/* Header */}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Skeleton className="h-7 w-40 rounded mb-2" />
        <Skeleton className="h-4 w-64 rounded" />
      </div>
      <Skeleton className="h-9 w-24 rounded-lg" />
    </div>
    
    {/* Stats Cards */}
    <StatsGridSkeleton count={4} />
    
    {/* Chart */}
    <ChartSkeleton height={250} />
    
    {/* Table */}
    <TableSkeleton rows={10} columns={5} />
  </div>
);

// Tools page skeleton
export const ToolsPageSkeleton: React.FC = () => (
  <div className="space-y-4 p-4 md:p-6 animate-pulse">
    {/* Header */}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Skeleton className="h-7 w-32 rounded mb-2" />
        <Skeleton className="h-4 w-56 rounded" />
      </div>
      <Skeleton className="h-9 w-24 rounded-lg" />
    </div>
    
    {/* Stats Cards */}
    <StatsGridSkeleton count={4} />
    
    {/* Chart */}
    <ChartSkeleton height={200} />
    
    {/* Tools Grid */}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border-light bg-surface-primary p-4">
          <div className="flex items-center gap-3 mb-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-4 w-24 rounded mb-1" />
              <Skeleton className="h-3 w-16 rounded" />
            </div>
          </div>
          <Skeleton className="h-3 w-full rounded mb-2" />
          <Skeleton className="h-3 w-2/3 rounded" />
        </div>
      ))}
    </div>
  </div>
);

// Guardrails page skeleton
export const GuardrailsPageSkeleton: React.FC = () => (
  <div className="space-y-4 p-4 md:p-6 animate-pulse">
    {/* Header */}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Skeleton className="h-7 w-32 rounded mb-2" />
        <Skeleton className="h-4 w-64 rounded" />
      </div>
      <Skeleton className="h-9 w-24 rounded-lg" />
    </div>
    
    {/* Stats Cards */}
    <StatsGridSkeleton count={4} />
    
    {/* Chart */}
    <ChartSkeleton height={200} />
    
    {/* Table */}
    <TableSkeleton rows={8} columns={5} />
  </div>
);

// User Detail page skeleton
export const UserDetailPageSkeleton: React.FC = () => (
  <div className="space-y-4 md:space-y-6 p-4 md:p-6 lg:p-8 animate-pulse">
    {/* Back button */}
    <div className="flex items-center gap-2 md:gap-4">
      <Skeleton className="h-8 w-32 rounded" />
    </div>

    {/* User Profile Card */}
    <div className="bg-surface-secondary rounded-xl border border-border-light p-4 md:p-6">
      <div className="flex flex-col gap-4 md:gap-6">
        {/* User Info */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Avatar */}
          <Skeleton className="w-16 h-16 md:w-20 md:h-20 rounded-full flex-shrink-0" />
          <div className="flex-1 min-w-0">
            {/* Name and badges */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Skeleton className="h-7 w-40 rounded" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
            {/* Email */}
            <Skeleton className="h-4 w-48 rounded mb-2" />
            {/* Username */}
            <Skeleton className="h-4 w-32 rounded mb-3" />
            {/* Meta info */}
            <div className="flex flex-wrap gap-4">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-4 w-24 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Stats Grid */}
    <StatsGridSkeleton count={4} />

    {/* Tabs */}
    <div className="flex gap-2 border-b border-border-light pb-2">
      <Skeleton className="h-9 w-24 rounded" />
      <Skeleton className="h-9 w-24 rounded" />
      <Skeleton className="h-9 w-24 rounded" />
      <Skeleton className="h-9 w-24 rounded" />
    </div>

    {/* Tab Content - Sessions table as default */}
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32 rounded" />
        <Skeleton className="h-8 w-24 rounded" />
      </div>
      <TableSkeleton rows={5} columns={4} />
    </div>

    {/* Actions Card */}
    <div className="bg-surface-secondary rounded-xl border border-border-light p-4 md:p-6">
      <Skeleton className="h-5 w-28 rounded mb-4" />
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-20 rounded" />
        <Skeleton className="h-9 w-28 rounded" />
        <Skeleton className="h-9 w-24 rounded" />
      </div>
    </div>
  </div>
);

// Users list page skeleton
export const UsersPageSkeleton: React.FC = () => (
  <div className="space-y-4 p-4 md:p-6 animate-pulse">
    {/* Header */}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Skeleton className="h-7 w-24 rounded mb-2" />
        <Skeleton className="h-4 w-48 rounded" />
      </div>
    </div>
    
    {/* Filters */}
    <div className="flex flex-wrap gap-3">
      <Skeleton className="h-9 w-64 rounded" />
      <Skeleton className="h-9 w-32 rounded" />
      <Skeleton className="h-9 w-32 rounded" />
    </div>
    
    {/* Table */}
    <TableSkeleton rows={10} columns={6} />
    
    {/* Pagination */}
    <div className="flex justify-between items-center">
      <Skeleton className="h-4 w-32 rounded" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-8 w-8 rounded" />
      </div>
    </div>
  </div>
);

// Roles page skeleton
export const RolesPageSkeleton: React.FC = () => (
  <div className="space-y-6 p-6 md:p-8 animate-pulse">
    {/* Header */}
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Skeleton className="h-7 w-40 rounded mb-2" />
        <Skeleton className="h-4 w-56 rounded" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-28 rounded" />
        <Skeleton className="h-9 w-9 rounded" />
      </div>
    </div>

    {/* Roles Grid */}
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-surface-secondary rounded-xl border border-border-light p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div>
                <Skeleton className="h-5 w-24 rounded mb-1" />
                <Skeleton className="h-3 w-16 rounded" />
              </div>
            </div>
            <Skeleton className="h-8 w-8 rounded" />
          </div>
          <Skeleton className="h-4 w-full rounded mb-2" />
          <Skeleton className="h-4 w-3/4 rounded" />
        </div>
      ))}
    </div>
  </div>
);

// Active Users page skeleton
export const ActiveUsersPageSkeleton: React.FC = () => (
  <div className="space-y-4 md:space-y-6 p-4 md:p-6 animate-pulse">
    {/* Header */}
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Skeleton className="h-7 w-32 rounded mb-2" />
        <Skeleton className="h-4 w-64 rounded" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-24 rounded" />
      </div>
    </div>

    {/* Stats Grid */}
    <StatsGridSkeleton count={4} />

    {/* Sessions Table */}
    <div className="bg-surface-secondary rounded-xl border border-border-light p-4">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-5 w-32 rounded" />
        <Skeleton className="h-8 w-48 rounded" />
      </div>
      <TableSkeleton rows={8} columns={5} />
    </div>
  </div>
);

// Settings page skeleton
export const SettingsPageSkeleton: React.FC = () => (
  <div className="space-y-6 p-6 md:p-8 animate-pulse">
    {/* Header */}
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <Skeleton className="h-7 w-36 rounded mb-2" />
        <Skeleton className="h-4 w-64 rounded" />
      </div>
      <Skeleton className="h-9 w-24 rounded" />
    </div>

    {/* System Health Card */}
    <div className="bg-surface-secondary rounded-xl border border-border-light p-6">
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div>
          <Skeleton className="h-5 w-28 rounded mb-1" />
          <Skeleton className="h-4 w-40 rounded" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-4 bg-surface-tertiary rounded-lg">
            <Skeleton className="h-4 w-20 rounded mb-2" />
            <Skeleton className="h-6 w-16 rounded" />
          </div>
        ))}
      </div>
    </div>

    {/* Cache Management Card */}
    <div className="bg-surface-secondary rounded-xl border border-border-light p-6">
      <Skeleton className="h-5 w-36 rounded mb-4" />
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-32 rounded" />
        <Skeleton className="h-9 w-32 rounded" />
        <Skeleton className="h-9 w-32 rounded" />
      </div>
    </div>

    {/* Cost Calculator Card */}
    <div className="bg-surface-secondary rounded-xl border border-border-light p-6">
      <Skeleton className="h-5 w-28 rounded mb-4" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-10 w-full rounded" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-10 w-full rounded" />
        </div>
      </div>
    </div>
  </div>
);

export default {
  StatCardSkeleton,
  StatsGridSkeleton,
  ChartSkeleton,
  TableRowSkeleton,
  TableSkeleton,
  TraceRowSkeleton,
  TracesTableSkeleton,
  FilterBarSkeleton,
  DashboardActivitySkeleton,
  DashboardPageSkeleton,
  TracesPageSkeleton,
  AgentsPageSkeleton,
  CostsPageSkeleton,
  ToolsPageSkeleton,
  GuardrailsPageSkeleton,
  UserDetailPageSkeleton,
  UsersPageSkeleton,
  RolesPageSkeleton,
  ActiveUsersPageSkeleton,
  SettingsPageSkeleton,
};
