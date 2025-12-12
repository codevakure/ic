/**
 * Admin Skeleton Components
 * 
 * Reusable skeleton loading states for admin pages to provide
 * better visual feedback during data loading.
 */
import React from 'react';
import { Skeleton } from '@ranger/client';
import { cn } from '~/utils';

// Base skeleton card for stats/metrics - matches actual stat card styling
interface StatCardSkeletonProps {
  className?: string;
  size?: 'default' | 'large';
}

export const StatCardSkeleton: React.FC<StatCardSkeletonProps> = ({ 
  className, 
  size = 'default' 
}) => (
  <div className={cn(
    'rounded-lg border border-border-light bg-surface-primary p-3',
    className
  )}>
    <div className="flex items-center justify-between">
      <Skeleton className="h-3 w-20 rounded" />
      <Skeleton className="h-7 w-7 rounded-lg" />
    </div>
    <Skeleton className={cn(
      'mt-1 rounded',
      size === 'large' ? 'h-7 w-20' : 'h-6 w-16'
    )} />
  </div>
);

// Skeleton for stats grid - matches actual grid layout
interface StatsGridSkeletonProps {
  count?: number;
  columns?: 2 | 4 | 7;
  className?: string;
}

export const StatsGridSkeleton: React.FC<StatsGridSkeletonProps> = ({ 
  count = 4, 
  columns = 4,
  className 
}) => (
  <div className={cn(
    'grid gap-3',
    columns === 2 && 'grid-cols-2',
    columns === 4 && 'grid-cols-2 md:grid-cols-4',
    columns === 7 && 'sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7',
    className
  )}>
    {Array.from({ length: count }).map((_, i) => (
      <StatCardSkeleton key={i} />
    ))}
  </div>
);

// Skeleton for chart panels - matches actual chart card styling
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
    'rounded-lg border border-border-light bg-surface-primary p-4',
    className
  )}>
    {title && (
      <div className="mb-3">
        <Skeleton className="h-4 w-24 rounded" />
      </div>
    )}
    <Skeleton 
      className="w-full rounded" 
      style={{ height: `${height}px` }} 
    />
  </div>
);

// Skeleton for table rows - matches actual table cell styling
interface TableRowSkeletonProps {
  columns?: number;
  className?: string;
}

export const TableRowSkeleton: React.FC<TableRowSkeletonProps> = ({ 
  columns = 6,
  className 
}) => (
  <div className={cn(
    'grid gap-4 items-center px-3 py-2 border-b border-border-light/50 last:border-0',
    className
  )} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
    {Array.from({ length: columns }).map((_, i) => (
      <Skeleton 
        key={i} 
        className={cn(
          'h-4 rounded',
          i === 0 ? 'w-24' : 'w-14'
        )} 
      />
    ))}
  </div>
);

// Skeleton for full table - matches actual table styling
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
            <Skeleton key={i} className="h-3 w-14 rounded" />
          ))}
        </div>
      </div>
    )}
    <div>
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

// Traces page skeleton - matches TracesPage layout
export const TracesPageSkeleton: React.FC = () => (
  <div className="space-y-4 p-4 md:p-5 animate-pulse">
    {/* Header */}
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div>
        <Skeleton className="h-6 w-40 rounded mb-2" />
        <Skeleton className="h-4 w-72 rounded" />
      </div>
      <Skeleton className="h-9 w-24 rounded-lg" />
    </div>
    
    {/* Summary Stats */}
    <StatsGridSkeleton count={4} columns={4} />
    
    {/* Filters */}
    <FilterBarSkeleton />
    
    {/* Traces Table */}
    <TracesTableSkeleton rows={10} />
    
    {/* Pagination */}
    <div className="flex items-center justify-between">
      <Skeleton className="h-4 w-48 rounded" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
    </div>
  </div>
);

// Agents page skeleton - matches AgentsPage layout
export const AgentsPageSkeleton: React.FC = () => (
  <div className="space-y-4 p-4 md:p-5 animate-pulse">
    {/* Header with Date Picker */}
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div>
        <Skeleton className="h-6 w-32 rounded mb-2" />
        <Skeleton className="h-4 w-56 rounded" />
      </div>
      <Skeleton className="h-9 w-72 rounded-lg" />
    </div>
    
    {/* Stats Cards */}
    <StatsGridSkeleton count={4} columns={4} />
    
    {/* Charts Row */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartSkeleton height={200} />
      <ChartSkeleton height={200} />
    </div>
    
    {/* Table */}
    <TableSkeleton rows={8} columns={6} />
  </div>
);

// Costs page skeleton - matches CostsPage layout
export const CostsPageSkeleton: React.FC = () => (
  <div className="space-y-4 p-4 md:p-5 animate-pulse">
    {/* Header with Date Picker */}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Skeleton className="h-6 w-16 rounded mb-2" />
        <Skeleton className="h-4 w-64 rounded" />
      </div>
      <Skeleton className="h-9 w-72 rounded-lg" />
    </div>
    
    {/* Stats Cards - 7 columns on xl */}
    <StatsGridSkeleton count={7} columns={7} />
    
    {/* Chart */}
    <ChartSkeleton height={250} />
    
    {/* Table */}
    <TableSkeleton rows={10} columns={5} />
  </div>
);

// Tools page skeleton - matches ToolsPage layout
export const ToolsPageSkeleton: React.FC = () => (
  <div className="space-y-4 p-4 md:p-5 animate-pulse">
    {/* Header with Date Picker */}
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div>
        <Skeleton className="h-6 w-32 rounded mb-2" />
        <Skeleton className="h-4 w-56 rounded" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-72 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
    </div>
    
    {/* Stats Cards */}
    <StatsGridSkeleton count={4} columns={4} />
    
    {/* Charts Row */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartSkeleton height={240} />
      <ChartSkeleton height={240} />
    </div>
    
    {/* Table */}
    <div className="rounded-lg border border-border-light bg-surface-primary overflow-hidden">
      <div className="px-4 py-3 border-b border-border-light">
        <Skeleton className="h-4 w-20 rounded" />
      </div>
      <div className="p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-border-light/50 last:border-0">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-4 w-32 rounded" />
            </div>
            <Skeleton className="h-4 w-16 rounded" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Guardrails page skeleton - matches GuardrailsPage layout
export const GuardrailsPageSkeleton: React.FC = () => (
  <div className="space-y-4 p-4 md:p-5 animate-pulse">
    {/* Header with Date Picker */}
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div>
        <Skeleton className="h-6 w-40 rounded mb-2" />
        <Skeleton className="h-4 w-64 rounded" />
      </div>
      <Skeleton className="h-9 w-72 rounded-lg" />
    </div>
    
    {/* Stats Cards */}
    <StatsGridSkeleton count={4} columns={4} />
    
    {/* Secondary Stats Row */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
    
    {/* Charts Row */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartSkeleton height={200} />
      <ChartSkeleton height={200} />
    </div>
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

// Users list page skeleton - matches UsersPage layout
export const UsersPageSkeleton: React.FC = () => (
  <div className="space-y-4 p-4 md:p-5 animate-pulse">
    {/* Header with Search */}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Skeleton className="h-6 w-24 rounded mb-2" />
        <Skeleton className="h-4 w-48 rounded" />
      </div>
      <Skeleton className="h-9 w-64 rounded-lg" />
    </div>
    
    {/* Filters Row */}
    <div className="flex flex-wrap items-center gap-3">
      <Skeleton className="h-9 w-32 rounded-lg" />
      <Skeleton className="h-9 w-32 rounded-lg" />
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

// Active Users page skeleton - matches ActiveUsersPage layout
export const ActiveUsersPageSkeleton: React.FC = () => (
  <div className="space-y-4 p-4 md:p-5 animate-pulse">
    {/* Header */}
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <Skeleton className="h-6 w-28 rounded mb-2" />
        <Skeleton className="h-4 w-64 rounded" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="h-8 w-16 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>

    {/* Stats Grid */}
    <StatsGridSkeleton count={4} columns={4} />

    {/* Tabs */}
    <div className="flex items-center gap-1 border-b border-border-light pb-2">
      <Skeleton className="h-8 w-24 rounded" />
      <Skeleton className="h-8 w-28 rounded" />
    </div>

    {/* Search */}
    <Skeleton className="h-9 w-full max-w-md rounded-lg" />

    {/* Sessions List */}
    <div className="rounded-lg border border-border-light bg-surface-primary overflow-hidden">
      <div className="px-4 py-3 border-b border-border-light">
        <Skeleton className="h-4 w-32 rounded" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-border-light/50 last:border-0">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div>
              <Skeleton className="h-4 w-32 rounded mb-1" />
              <Skeleton className="h-3 w-40 rounded" />
            </div>
          </div>
          <Skeleton className="h-6 w-6 rounded" />
        </div>
      ))}
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
