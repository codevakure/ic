import React, { useState, useEffect } from 'react';
import {
  Settings,
  Server,
  Database,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Trash2,
  Zap,
  Key,
  Heart,
  HardDrive,
  Cpu,
  UserX,
} from 'lucide-react';
import {
  Button,
  Input,
  Label,
  Spinner,
  Switch,
} from '@librechat/client';
import { StatsCard } from '../components/StatsCard';
import { systemApi, usersApi } from '../services/adminApi';

interface SystemHealth {
  status?: 'healthy' | 'degraded' | 'unhealthy';
  timestamp?: string;
  services?: {
    mongodb: { status: string; connected: boolean };
    api: { status: string; uptime: number; uptimeFormatted: string };
  };
  process?: {
    memory: {
      heapUsed: number;
      heapTotal: number;
      rss: number;
      heapUsedMB: number;
      heapTotalMB: number;
      rssMB: number;
    };
    cpu: { user: number; system: number };
    pid: number;
  };
  system?: {
    platform: string;
    arch: string;
    hostname: string;
    cpuCount: number;
    loadAverage: number[];
    memory: {
      total: number;
      free: number;
      used: number;
      usedPercent: string;
      totalGB: string;
      freeGB: string;
    };
    uptime: number;
    uptimeFormatted: string;
  };
  node?: {
    version: string;
    env: string;
  };
}

interface CacheStats {
  hits?: number;
  misses?: number;
  keys?: number;
  memoryUsed?: number;
  [key: string]: unknown;
}

export function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [cacheEnabled, setCacheEnabled] = useState(true);
  const [cacheTtl, setCacheTtl] = useState(3600);
  const [activeTab, setActiveTab] = useState<'health' | 'cache'>('health');
  const [actionResult, setActionResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [healthData] = await Promise.all([
        systemApi.getSystemHealth(),
      ]);
      setHealth(healthData as unknown as SystemHealth);
      
      // Fetch cache stats
      try {
        const stats = await systemApi.getCacheStats?.() || null;
        setCacheStats(stats as unknown as CacheStats);
      } catch (err) {
        console.warn('Could not fetch cache stats:', err);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFlushCache = async () => {
    try {
      await systemApi.flushCache?.();
      setActionResult({ type: 'success', message: 'Cache flushed successfully' });
      setTimeout(() => setActionResult(null), 3000);
      fetchData();
    } catch (err) {
      setActionResult({ type: 'error', message: 'Failed to flush cache' });
      setTimeout(() => setActionResult(null), 3000);
    }
  };

  const handleClearBannedUsers = async () => {
    try {
      // Get all banned users and unban them
      const result = await usersApi.list({ status: 'banned', limit: 100 });
      if (result.users.length === 0) {
        setActionResult({ type: 'success', message: 'No banned users to clear' });
        setTimeout(() => setActionResult(null), 3000);
        return;
      }
      
      // Unban all users
      let unbanCount = 0;
      for (const user of result.users) {
        try {
          await usersApi.toggleBan(user._id, false);
          unbanCount++;
        } catch (e) {
          console.error('Failed to unban user:', user._id, e);
        }
      }
      
      setActionResult({ type: 'success', message: `Cleared ${unbanCount} banned user(s)` });
      setTimeout(() => setActionResult(null), 3000);
    } catch (err) {
      setActionResult({ type: 'error', message: 'Failed to clear banned users' });
      setTimeout(() => setActionResult(null), 3000);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-400 bg-green-500/20';
      case 'degraded': return 'text-yellow-400 bg-yellow-500/20';
      case 'unhealthy': return 'text-red-400 bg-red-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4" />;
      case 'degraded': return <AlertTriangle className="h-4 w-4" />;
      case 'unhealthy': return <AlertTriangle className="h-4 w-4" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner className="text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">System Settings</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            System health, cache management, and cost calculator
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchData}
          className="text-[var(--text-secondary)]"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Action Result */}
      {actionResult && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          actionResult.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
        }`}>
          {actionResult.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          {actionResult.message}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-[var(--border-light)]">
        <nav className="flex gap-4">
          {(['health', 'cache'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-400'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab === 'health' ? 'System Health' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          {/* Overall Status */}
          <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className={`p-3 rounded-full ${getStatusColor(health?.status || 'unknown')}`}>
                <Heart className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">System Status</h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  Overall system health: <span className={`font-medium ${health?.status === 'healthy' ? 'text-green-400' : 'text-yellow-400'}`}>
                    {health?.status?.toUpperCase() || 'UNKNOWN'}
                  </span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* MongoDB Status */}
              <div className="bg-[var(--surface-primary-alt)] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="h-5 w-5 text-blue-400" />
                  <span className="font-medium text-[var(--text-primary)]">MongoDB</span>
                </div>
                <div className={`text-sm ${health?.services?.mongodb?.connected ? 'text-green-400' : 'text-red-400'}`}>
                  {health?.services?.mongodb?.connected ? 'Connected' : 'Disconnected'}
                </div>
              </div>

              {/* API Status */}
              <div className="bg-[var(--surface-primary-alt)] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Server className="h-5 w-5 text-green-400" />
                  <span className="font-medium text-[var(--text-primary)]">API Server</span>
                </div>
                <div className="text-sm text-green-400">
                  {health?.services?.api?.uptimeFormatted || 'Running'}
                </div>
              </div>

              {/* Memory */}
              <div className="bg-[var(--surface-primary-alt)] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <HardDrive className="h-5 w-5 text-purple-400" />
                  <span className="font-medium text-[var(--text-primary)]">Memory</span>
                </div>
                <div className="text-sm text-[var(--text-secondary)]">
                  {health?.process?.memory?.heapUsedMB?.toFixed(0) || 0} MB / {health?.process?.memory?.heapTotalMB?.toFixed(0) || 0} MB
                </div>
              </div>

              {/* CPU */}
              <div className="bg-[var(--surface-primary-alt)] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Cpu className="h-5 w-5 text-orange-400" />
                  <span className="font-medium text-[var(--text-primary)]">System</span>
                </div>
                <div className="text-sm text-[var(--text-secondary)]">
                  {health?.system?.platform || 'N/A'} ({health?.system?.cpuCount || 0} cores)
                </div>
              </div>
            </div>
          </div>

          {/* System Details */}
          {health?.system && (
            <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-6">
              <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <Server className="h-5 w-5 text-blue-400" />
                System Details
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-[var(--text-secondary)]">Platform</p>
                  <p className="text-[var(--text-primary)] font-medium">{health.system.platform}</p>
                </div>
                <div>
                  <p className="text-[var(--text-secondary)]">Architecture</p>
                  <p className="text-[var(--text-primary)] font-medium">{health.system.arch}</p>
                </div>
                <div>
                  <p className="text-[var(--text-secondary)]">Hostname</p>
                  <p className="text-[var(--text-primary)] font-medium">{health.system.hostname}</p>
                </div>
                <div>
                  <p className="text-[var(--text-secondary)]">Uptime</p>
                  <p className="text-[var(--text-primary)] font-medium">{health.system.uptimeFormatted}</p>
                </div>
                <div>
                  <p className="text-[var(--text-secondary)]">Node.js</p>
                  <p className="text-[var(--text-primary)] font-medium">{health?.node?.version || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[var(--text-secondary)]">Environment</p>
                  <p className="text-[var(--text-primary)] font-medium">{health?.node?.env || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[var(--text-secondary)]">Total Memory</p>
                  <p className="text-[var(--text-primary)] font-medium">{health.system.memory.totalGB}</p>
                </div>
                <div>
                  <p className="text-[var(--text-secondary)]">Free Memory</p>
                  <p className="text-[var(--text-primary)] font-medium">{health.system.memory.freeGB}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'cache' && (
        <div className="space-y-6">
          {/* Cache Stats */}
          {cacheStats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatsCard
                title="Cache Hits"
                value={(cacheStats.hits || 0).toLocaleString()}
                icon={<CheckCircle className="h-5 w-5 text-green-500" />}
                info="Number of cache hits"
              />
              <StatsCard
                title="Cache Misses"
                value={(cacheStats.misses || 0).toLocaleString()}
                icon={<AlertTriangle className="h-5 w-5 text-yellow-500" />}
                info="Number of cache misses"
              />
              <StatsCard
                title="Cache Keys"
                value={(cacheStats.keys || 0).toLocaleString()}
                icon={<Key className="h-5 w-5 text-blue-500" />}
                info="Total keys stored in cache"
              />
              <StatsCard
                title="Memory Used"
                value={`${((cacheStats.memoryUsed || 0) / 1024 / 1024).toFixed(1)} MB`}
                icon={<Database className="h-5 w-5 text-purple-500" />}
                info="Redis memory usage"
              />
            </div>
          )}

          {/* Cache Settings */}
          <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-6">
            <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-red-400" />
              Cache Configuration
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-[var(--text-primary)]">Redis Cache</Label>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Enable Redis for caching and session storage
                  </p>
                </div>
                <Switch
                  aria-label="Enable Redis cache"
                  checked={cacheEnabled}
                  onCheckedChange={setCacheEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--text-primary)]">Default TTL (seconds)</Label>
                <Input
                  type="number"
                  value={cacheTtl}
                  onChange={(e) => setCacheTtl(parseInt(e.target.value) || 3600)}
                  className="bg-[var(--surface-primary-alt)] border-[var(--border-light)]"
                />
              </div>
            </div>
          </div>

          {/* Cache Actions */}
          <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-6">
            <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-orange-400" />
              Cache Actions
            </h3>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={handleFlushCache}
                className="border-red-500 text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Flush All Cache
              </Button>
              <Button
                variant="outline"
                onClick={fetchData}
                className="border-blue-500 text-blue-400 hover:bg-blue-500/10"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Stats
              </Button>
            </div>
            <p className="mt-3 text-xs text-[var(--text-secondary)]">
              Warning: Flushing cache will clear all cached data including sessions. Users may need to log in again.
            </p>
          </div>

          {/* User Management Actions */}
          <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-6">
            <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <UserX className="h-5 w-5 text-yellow-400" />
              User Management
            </h3>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={handleClearBannedUsers}
                className="border-yellow-500 text-yellow-400 hover:bg-yellow-500/10"
              >
                <UserX className="h-4 w-4 mr-2" />
                Clear All Banned Users
              </Button>
            </div>
            <p className="mt-3 text-xs text-[var(--text-secondary)]">
              This will remove the ban status from all currently banned users, allowing them to access the system again.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;
