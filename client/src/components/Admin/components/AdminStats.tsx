/**
 * Admin Stats Ticker Component
 * 
 * Displays key metrics as badges in the admin top navigation.
 * Shows: Active Sessions, Total Users, Total Files, Total Cost, Input Tokens, Output Tokens
 */
import React, { useEffect, useState } from 'react';
import { Users, Activity, FileText, DollarSign, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { dashboardApi } from '../services/adminApi';

interface AdminStatsData {
  activeSessions: number;
  totalUsers: number;
  totalFiles: number;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
}

export function AdminStats() {
  const [stats, setStats] = useState<AdminStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const overview = await dashboardApi.getOverview();

        // Use accurate cost from API (calculated on server with model-specific pricing)
        const totalCost = overview.tokens?.totalCost || 0;

        setStats({
          activeSessions: overview.activeSessions || 0,
          totalUsers: overview.users?.total || 0,
          totalFiles: overview.totalFiles || 0,
          totalCost: totalCost,
          inputTokens: overview.tokens?.input || 0,
          outputTokens: overview.tokens?.output || 0,
        });
      } catch (error) {
        console.error('Failed to fetch admin stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    // Refresh every 60 seconds
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !stats) {
    return null;
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(2)}`;
  };

  const badges = [
    {
      label: 'Active',
      value: stats.activeSessions,
      icon: Activity,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
    },
    {
      label: 'Users',
      value: stats.totalUsers,
      icon: Users,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
    },
    {
      label: 'Cost',
      value: formatCost(stats.totalCost),
      icon: DollarSign,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
      isFormatted: true,
    },
    {
      label: 'In',
      value: formatNumber(stats.inputTokens),
      icon: ArrowDownCircle,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/20',
      isFormatted: true,
    },
    {
      label: 'Out',
      value: formatNumber(stats.outputTokens),
      icon: ArrowUpCircle,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
      isFormatted: true,
    },
  ];

  return (
    <div className="flex items-center gap-2">
      {badges.map((badge) => {
        const IconComponent = badge.icon;
        return (
          <div
            key={badge.label}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${badge.bgColor} text-xs font-medium`}
          >
            <IconComponent className={`h-3 w-3 ${badge.color}`} />
            <span className={badge.color}>
              {badge.isFormatted ? badge.value : formatNumber(badge.value as number)}
            </span>
            <span className="text-[var(--text-tertiary)] hidden sm:inline">{badge.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default AdminStats;
