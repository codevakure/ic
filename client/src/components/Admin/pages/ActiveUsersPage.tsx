import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Clock,
  Activity,
  RefreshCw,
  Search,
  ChevronRight,
  Circle,
  Globe,
  Monitor,
  MessageSquare,
  Zap,
  ArrowUpRight,
} from 'lucide-react';
import { Button, Input, Spinner } from '@ranger/client';
import { StatsCard } from '../components/StatsCard';
import { activeUsersApi } from '../services/adminApi';

interface Session {
  sessionId: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    username?: string;
    avatar?: string;
    role?: string;
  };
  startTime: string;
  lastActivity: string;
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  browser?: string;
  os?: string;
  conversationCount?: number;
  messageCount?: number;
  tokensUsed?: number;
  isOnline?: boolean;
  sessionCount?: number; // Number of active sessions for this user (grouped by backend)
}

interface ActiveUsersData {
  sessions: Session[];
  summary: {
    totalActiveSessions: number;
    uniqueActiveUsers: number;
    averageSessionDuration?: number;
  };
  byDevice?: Record<string, number>;
  byLocation?: Record<string, number>;
}

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

function parseUserAgent(ua?: string): { device: string; browser: string; os: string } {
  if (!ua) return { device: 'Unknown', browser: 'Unknown', os: 'Unknown' };
  
  let device = 'Desktop';
  let browser = 'Unknown';
  let os = 'Unknown';
  
  if (/Mobile|Android|iPhone|iPad/i.test(ua)) device = 'Mobile';
  if (/Tablet|iPad/i.test(ua)) device = 'Tablet';
  
  if (/Chrome/i.test(ua)) browser = 'Chrome';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Safari/i.test(ua)) browser = 'Safari';
  else if (/Edge/i.test(ua)) browser = 'Edge';
  
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iOS|iPhone|iPad/i.test(ua)) os = 'iOS';
  
  return { device, browser, os };
}

export function ActiveUsersPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<ActiveUsersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      const response = await activeUsersApi.getActiveUsers();
      setData(response);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      setError('Failed to load active users data');
      console.error('Error fetching active users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  const handleRefresh = () => {
    setLoading(true);
    fetchData();
  };

  // Filter sessions based on search (backend already groups by user)
  const filteredSessions = data?.sessions?.filter((session) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      session.user.name?.toLowerCase().includes(query) ||
      session.user.email?.toLowerCase().includes(query) ||
      session.user.username?.toLowerCase().includes(query) ||
      session.ipAddress?.includes(query)
    );
  }) || [];

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner className="text-blue-600" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-red-400">
        <p>{error}</p>
        <Button onClick={handleRefresh} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  const stats = [
    {
      title: 'Active Sessions',
      value: data?.summary?.totalActiveSessions || 0,
      icon: Activity,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      info: 'Total number of active sessions across all users',
    },
    {
      title: 'Unique Users',
      value: data?.summary?.uniqueActiveUsers || data?.sessions?.length || 0,
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      info: 'Distinct users with active sessions',
    },
    {
      title: 'Avg Session Duration',
      value: formatDuration(data?.summary?.averageSessionDuration || 0),
      icon: Clock,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      info: 'Average length of current active sessions',
    },
    {
      title: 'Sessions Today',
      value: data?.summary?.totalActiveSessions || 0,
      icon: Zap,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      info: 'Total number of sessions today',
    },
  ];

  return (
    <div className="space-y-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Active Users</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            Monitor currently active sessions in real-time
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--text-secondary)]">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'border-green-500 text-green-500' : ''}
          >
            <Circle className={`h-2 w-2 mr-2 ${autoRefresh ? 'fill-green-500 text-green-500' : ''}`} />
            {autoRefresh ? 'Live' : 'Paused'}
          </Button>
          <Button
            onClick={handleRefresh}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const IconComponent = stat.icon;
          return (
            <StatsCard
              key={stat.title}
              title={stat.title}
              value={stat.value}
              icon={<IconComponent className={`h-5 w-5 ${stat.color}`} />}
              info={stat.info}
            />
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[var(--text-secondary)]" />
        <Input
          placeholder="Search by name, email, or IP..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-[var(--surface-primary)] border-[var(--border-light)]"
        />
      </div>

      {/* Sessions List - Grouped by User (backend groups by user) */}
      <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] overflow-hidden">
        <div className="p-4 border-b border-[var(--border-light)]">
          <h2 className="font-semibold text-[var(--text-primary)]">
            Active Sessions ({filteredSessions.length} {filteredSessions.length === 1 ? 'user' : 'users'})
          </h2>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-secondary)]">
            {searchQuery ? 'No users match your search' : 'No active sessions'}
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-light)]">
            {filteredSessions.map((session) => {
              const { device, browser, os } = session.device
                ? { device: session.device, browser: session.browser || 'Unknown', os: session.os || 'Unknown' }
                : parseUserAgent(session.userAgent);

              return (
                <div
                  key={session.sessionId}
                  className="p-4 hover:bg-[var(--surface-primary-alt)] cursor-pointer transition-colors"
                  onClick={() => navigate(`/admin/users/${session.userId}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Avatar with online indicator */}
                      <div className="relative">
                        {session.user.avatar ? (
                          <img
                            src={session.user.avatar}
                            alt={session.user.name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                            {session.user.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        )}
                        <span
                          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[var(--surface-primary)] ${
                            session.isOnline !== false ? 'bg-green-500' : 'bg-yellow-500'
                          }`}
                        />
                      </div>

                      {/* User info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[var(--text-primary)]">
                            {session.user.name}
                          </span>
                          {session.user.role === 'admin' && (
                            <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-400 rounded">
                              Admin
                            </span>
                          )}
                          {session.sessionCount && session.sessionCount > 1 && (
                            <span className="px-1.5 py-0.5 text-xs font-medium bg-purple-500/20 text-purple-400 rounded">
                              {session.sessionCount} sessions
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[var(--text-secondary)]">
                          {session.user.email}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-secondary)]">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {getTimeAgo(session.lastActivity)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Monitor className="h-3 w-3" />
                            {device} • {browser} • {os}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* User stats */}
                    <div className="flex items-center gap-6">
                      {session.conversationCount !== undefined && session.conversationCount > 0 && (
                        <div className="text-center">
                          <div className="text-sm font-semibold text-[var(--text-primary)]">
                            {session.conversationCount}
                          </div>
                          <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            Chats
                          </div>
                        </div>
                      )}
                      {session.messageCount !== undefined && session.messageCount > 0 && (
                        <div className="text-center">
                          <div className="text-sm font-semibold text-[var(--text-primary)]">
                            {session.messageCount}
                          </div>
                          <div className="text-xs text-[var(--text-secondary)]">
                            Messages
                          </div>
                        </div>
                      )}
                      {session.tokensUsed !== undefined && session.tokensUsed > 0 && (
                        <div className="text-center">
                          <div className="text-sm font-semibold text-[var(--text-primary)]">
                            {(session.tokensUsed / 1000).toFixed(1)}K
                          </div>
                          <div className="text-xs text-[var(--text-secondary)]">
                            Tokens
                          </div>
                        </div>
                      )}
                      <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300">
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Device & Location Distribution */}
      {(data?.byDevice || data?.byLocation) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.byDevice && Object.keys(data.byDevice).length > 0 && (
            <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-6">
              <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <Monitor className="h-5 w-5 text-blue-400" />
                Sessions by Device
              </h3>
              <div className="space-y-3">
                {Object.entries(data.byDevice).map(([device, count]) => {
                  const total = Object.values(data.byDevice!).reduce((a, b) => a + b, 0);
                  const percentage = ((count / total) * 100).toFixed(0);
                  return (
                    <div key={device}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[var(--text-secondary)]">{device}</span>
                        <span className="text-[var(--text-primary)]">{count} ({percentage}%)</span>
                      </div>
                      <div className="h-2 bg-[var(--surface-primary-alt)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {data.byLocation && Object.keys(data.byLocation).length > 0 && (
            <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-6">
              <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <Globe className="h-5 w-5 text-green-400" />
                Sessions by Location
              </h3>
              <div className="space-y-3">
                {Object.entries(data.byLocation).map(([location, count]) => {
                  const total = Object.values(data.byLocation!).reduce((a, b) => a + b, 0);
                  const percentage = ((count / total) * 100).toFixed(0);
                  return (
                    <div key={location}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[var(--text-secondary)]">{location}</span>
                        <span className="text-[var(--text-primary)]">{count} ({percentage}%)</span>
                      </div>
                      <div className="h-2 bg-[var(--surface-primary-alt)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-600 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ActiveUsersPage;
