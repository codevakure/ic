import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Mail,
  Calendar,
  Shield,
  Activity,
  MessageSquare,
  Coins,
  Clock,
  Ban,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Edit,
  Trash2,
  Globe,
  Monitor,
  Zap,
  TrendingUp,
  TrendingDown,
  Download,
  Cpu,
  ArrowUpRight,
  ArrowDownRight,
  X,
  ChevronRight,
} from 'lucide-react';
import {
  Button,
  Input,
  Spinner,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Label,
} from '@ranger/client';
import { StatsCard } from '../components/StatsCard';
import { AdminAreaChart as AreaChart, AdminBarChart as BarChart } from '../components/Charts';
import { UserDetailPageSkeleton, StatsGridSkeleton, TableSkeleton } from '../components/Skeletons';
import { usersApi, userDetailApi, type UserUsageResponse, type UserConversation, type UserConversationsResponse } from '../services/adminApi';

interface UserDetail {
  _id: string;
  name: string;
  email: string;
  username?: string;
  avatar?: string;
  role: string;
  provider?: string;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
  emailVerified?: boolean;
  banned?: boolean;
  banReason?: string;
  bannedAt?: string;
}

interface UserStats {
  user?: {
    _id: string;
    name: string;
    email: string;
  };
  stats?: {
    conversations: number;
    messages: number;
    balance: number;
    tokens: {
      totalTokens: number;
      totalCost: number;
      transactionCount: number;
    };
  };
  breakdowns?: {
    byEndpoint: { endpoint: string; count: number }[];
    byModel: { model: string; count: number }[];
  };
  activityTimeline?: { date: string; count: number }[];
  recentConversations?: {
    conversationId: string;
    title: string;
    endpoint: string;
    model: string;
    createdAt: string;
    updatedAt: string;
  }[];
  // Computed/UI fields
  totalConversations?: number;
  totalMessages?: number;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalCost?: number;
  avgMessagesPerConversation?: number;
  avgTokensPerMessage?: number;
  favoriteModel?: string;
  activeDays?: number;
  lastActiveAt?: string;
  conversationsByDay?: { date: string; count: number }[];
  tokensByDay?: { date: string; input: number; output: number }[];
  modelUsage?: { model: string; count: number; tokens: number }[];
}

interface Session {
  id?: string;
  sessionId?: string;
  startTime?: string;
  createdAt?: string;
  expiration?: string;
  lastActivity?: string;
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  browser?: string;
  os?: string;
  isActive: boolean;
}

interface Transaction {
  _id?: string;
  id?: string;
  type?: 'usage' | 'credit' | 'debit' | 'refund';
  tokenType?: string;
  amount?: number;
  rawAmount?: number;
  balance?: number;
  tokenValue?: number;
  description?: string;
  model?: string;
  context?: string;
  tokens?: number;
  createdAt: string;
}

// Conversation Drawer Component
interface ConversationDrawerProps {
  conversation: UserConversation | null;
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
}

function ConversationDrawer({ conversation, isOpen, onClose, userName }: ConversationDrawerProps) {
  if (!isOpen || !conversation) return null;

  const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 transition-opacity backdrop-blur-sm"
        style={{ zIndex: 9998 }}
        onClick={onClose}
      />
      
      {/* Drawer - Full screen on mobile, 50% on desktop */}
      <div 
        className="fixed right-0 top-0 h-screen w-full md:w-1/2 md:min-w-[500px] md:max-w-[800px] bg-[var(--surface-primary)] border-l border-[var(--border-light)] flex flex-col shadow-2xl"
        style={{ zIndex: 9999 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 md:px-4 py-3 border-b border-[var(--border-light)] bg-[var(--surface-secondary)]">
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            <div className={`flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-lg flex-shrink-0 ${
              conversation.hasErrors ? 'bg-red-500/20' : 'bg-blue-500/20'
            }`}>
              {conversation.hasErrors ? (
                <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-red-400" />
              ) : (
                <MessageSquare className="h-4 w-4 md:h-5 md:w-5 text-blue-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm md:text-base font-medium text-[var(--text-primary)] truncate">{conversation.title}</h2>
                {conversation.hasErrors && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-500/10 text-red-400 rounded flex-shrink-0">
                    {conversation.errorCount} error{conversation.errorCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="text-[10px] md:text-xs text-[var(--text-tertiary)]">
                {conversation.messageCount} messages • {conversation.model?.split('/').pop() || conversation.endpoint}
              </p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-1.5 md:p-2 hover:bg-[var(--surface-tertiary)] rounded-lg transition-colors flex-shrink-0"
          >
            <X className="h-4 w-4 md:h-5 md:w-5 text-[var(--text-secondary)]" />
          </button>
        </div>
        
        {/* Stats Bar */}
        <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 border-b border-[var(--border-light)] bg-[var(--surface-secondary)]/50 overflow-x-auto">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--surface-tertiary)] rounded-md">
            <User className="h-3 w-3 text-blue-400" />
            <span className="text-[10px] md:text-xs text-[var(--text-secondary)]">{userName || 'User'}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--surface-tertiary)] rounded-md">
            <Cpu className="h-3 w-3 text-purple-400" />
            <span className="text-[10px] md:text-xs text-[var(--text-secondary)] truncate max-w-[120px] md:max-w-none">{conversation.model?.split('/').pop() || conversation.endpoint}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--surface-tertiary)] rounded-md">
            <Clock className="h-3 w-3 text-green-400" />
            <span className="text-[10px] md:text-xs text-[var(--text-secondary)]">{formatDateTime(conversation.updatedAt)}</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4">
          {conversation.messages.map((msg, idx) => (
            <div
              key={msg.messageId || idx}
              className={`flex ${msg.isCreatedByUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] md:max-w-[75%] rounded-xl p-3 md:p-4 ${
                  msg.isCreatedByUser
                    ? 'bg-blue-600 text-white'
                    : msg.isError || msg.error
                    ? 'bg-red-500/10 border border-red-500/30 text-[var(--text-primary)]'
                    : 'bg-[var(--surface-tertiary)] text-[var(--text-primary)]'
                }`}
              >
                {/* Message Header */}
                <div className="flex items-center gap-2 mb-2">
                  {(msg.isError || msg.error) && !msg.isCreatedByUser && (
                    <AlertTriangle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                  )}
                  <span className={`text-[10px] md:text-xs font-medium ${
                    msg.isCreatedByUser ? 'text-blue-200' : msg.isError || msg.error ? 'text-red-400' : 'text-[var(--text-tertiary)]'
                  }`}>
                    {msg.sender}
                    {(msg.isError || msg.error) && !msg.isCreatedByUser && ' - Error'}
                  </span>
                  {msg.tokenCount && (
                    <span className={`text-[10px] md:text-xs px-1.5 py-0.5 rounded ${
                      msg.isCreatedByUser ? 'bg-blue-500/30 text-blue-200' : 'bg-[var(--surface-secondary)] text-[var(--text-tertiary)]'
                    }`}>
                      {msg.tokenCount} tokens
                    </span>
                  )}
                </div>
                
                {/* Message Text or Error Message */}
                <p className={`text-xs md:text-sm whitespace-pre-wrap leading-relaxed ${
                  (msg.isError || msg.error) && !msg.isCreatedByUser ? 'text-red-300' : ''
                }`}>{msg.text || (msg.errorMessage ? msg.errorMessage : '_No message text_')}</p>
                
                {/* Timestamp */}
                <p className={`text-[10px] md:text-xs mt-2 ${
                  msg.isCreatedByUser ? 'text-blue-200' : 'text-[var(--text-tertiary)]'
                }`}>
                  {formatDateTime(msg.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-3 md:px-4 py-2 border-t border-[var(--border-light)] bg-[var(--surface-secondary)]/50">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 text-[10px] md:text-xs text-[var(--text-tertiary)]">
            <span>Conversation ID: <code className="font-mono bg-[var(--surface-tertiary)] px-1.5 py-0.5 rounded text-[var(--text-secondary)]">{conversation.conversationId.slice(0, 12)}...</code></span>
            <span>Created: {formatDateTime(conversation.createdAt)}</span>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
}

export function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  
  const [user, setUser] = useState<UserDetail | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [usageData, setUsageData] = useState<UserUsageResponse | null>(null);
  const [conversations, setConversations] = useState<UserConversation[]>([]);
  const [conversationsPagination, setConversationsPagination] = useState<{ page: number; total: number; hasNext: boolean }>({ page: 1, total: 0, hasNext: false });
  const [selectedConversation, setSelectedConversation] = useState<UserConversation | null>(null);
  const [conversationDrawerOpen, setConversationDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  // Individual section loading states for progressive loading
  const [statsLoading, setStatsLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [usageLoading, setUsageLoading] = useState(true);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'conversations' | 'sessions' | 'transactions' | 'usage'>('overview');

  // Dialogs
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      // Reset section loading states
      setStatsLoading(true);
      setSessionsLoading(true);
      setTransactionsLoading(true);
      setUsageLoading(true);
      setConversationsLoading(true);
      
      // Use Promise.allSettled for progressive loading - show data as it arrives
      const [userResponse, statsResponse, sessionsResponse, transactionsResponse, usageResponse, conversationsResponse] = await Promise.allSettled([
        usersApi.getUser(userId),
        userDetailApi.getUserStats(userId),
        userDetailApi.getUserSessions(userId),
        userDetailApi.getUserTransactions(userId),
        usersApi.getUsage(userId),
        userDetailApi.getUserConversations(userId, 1, 20),
      ]);
      
      // Process user data first (required for page to render)
      if (userResponse.status === 'fulfilled') {
        setUser(userResponse.value as unknown as UserDetail);
        setSelectedRole(userResponse.value.role);
        setLoading(false); // Page can render once we have user
      } else {
        setError('Failed to load user details');
        setLoading(false);
        return;
      }
      
      // Process stats
      if (statsResponse.status === 'fulfilled') {
        setStats(statsResponse.value as unknown as UserStats);
      }
      setStatsLoading(false);
      
      // Process sessions
      if (sessionsResponse.status === 'fulfilled') {
        setSessions(sessionsResponse.value.activeSessions?.map(s => ({ ...s, isActive: s.isActive ?? true })) || []);
      }
      setSessionsLoading(false);
      
      // Process transactions
      if (transactionsResponse.status === 'fulfilled') {
        setTransactions(transactionsResponse.value.transactions?.map(t => ({ ...t, createdAt: t.createdAt })) || []);
      }
      setTransactionsLoading(false);
      
      // Process usage
      if (usageResponse.status === 'fulfilled') {
        setUsageData(usageResponse.value);
      }
      setUsageLoading(false);
      
      // Process conversations
      if (conversationsResponse.status === 'fulfilled') {
        setConversations(conversationsResponse.value.conversations || []);
        setConversationsPagination({
          page: conversationsResponse.value.pagination?.page || 1,
          total: conversationsResponse.value.pagination?.total || 0,
          hasNext: conversationsResponse.value.pagination?.hasNext || false,
        });
      }
      setConversationsLoading(false);
      
      setError(null);
    } catch (err) {
      setError('Failed to load user details');
      console.error('Error fetching user details:', err);
      setLoading(false);
      setStatsLoading(false);
      setSessionsLoading(false);
      setTransactionsLoading(false);
      setUsageLoading(false);
      setConversationsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBanUser = async () => {
    if (!userId) return;
    setActionLoading(true);
    try {
      await usersApi.banUser(userId, !user?.banned, banReason);
      await fetchData();
      setBanDialogOpen(false);
      setBanReason('');
    } catch (err) {
      console.error('Error banning user:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRoleChange = async () => {
    if (!userId || !selectedRole) return;
    setActionLoading(true);
    try {
      await usersApi.updateUserRole(userId, selectedRole);
      await fetchData();
      setRoleDialogOpen(false);
    } catch (err) {
      console.error('Error updating role:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userId) return;
    setActionLoading(true);
    try {
      await usersApi.deleteUser(userId);
      navigate('/admin/users');
    } catch (err) {
      console.error('Error deleting user:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const [terminatingSessionId, setTerminatingSessionId] = useState<string | null>(null);

  const handleTerminateSession = async (sessionId: string) => {
    if (!sessionId || terminatingSessionId) return;
    
    try {
      setTerminatingSessionId(sessionId);
      await userDetailApi.terminateSession(userId!, sessionId);
      // Optimistically remove the session from the list
      setSessions(prev => prev.filter(s => (s.sessionId || s.id) !== sessionId));
    } catch (err) {
      console.error('Error terminating session:', err);
      // On error, refresh sessions to get accurate state
      try {
        const sessionsResponse = await userDetailApi.getUserSessions(userId!);
        setSessions(sessionsResponse.activeSessions?.map(s => ({ ...s, isActive: s.isActive ?? true })) || []);
      } catch {
        // Ignore refresh errors
      }
    } finally {
      setTerminatingSessionId(null);
    }
  };

  if (loading) {
    return <UserDetailPageSkeleton />;
  }

  if (error || !user) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-red-400">
        <p>{error || 'User not found'}</p>
        <Button onClick={() => navigate('/admin/users')} className="mt-4">
          Back to Users
        </Button>
      </div>
    );
  }

  // Get token data from usageData (accurate) or fall back to stats
  const inputTokens = usageData?.totals?.inputTokens || 0;
  const outputTokens = usageData?.totals?.outputTokens || 0;
  const totalTokens = inputTokens + outputTokens;
  const totalCost = usageData?.totals?.totalCost || 0;
  
  // Get conversation/message counts from stats API
  const totalConversations = stats?.stats?.conversations || 0;
  const totalMessages = stats?.stats?.messages || 0;

  const overviewStats = [
    {
      title: 'Total Conversations',
      value: totalConversations,
      icon: MessageSquare,
      info: 'Total number of conversations created by this user',
    },
    {
      title: 'Total Messages',
      value: totalMessages,
      icon: Activity,
      info: 'Total messages sent across all conversations',
    },
    {
      title: 'Total Tokens',
      value: `${(totalTokens / 1000).toFixed(1)}K`,
      icon: Zap,
      info: `Input: ${(inputTokens / 1000).toFixed(1)}K | Output: ${(outputTokens / 1000).toFixed(1)}K`,
    },
    {
      title: 'Total Cost',
      value: `$${totalCost.toFixed(4)}`,
      icon: Coins,
      info: 'Estimated cost based on token usage and model pricing',
    },
  ];

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-2 md:gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/admin/users')}
          className="text-[var(--text-secondary)] px-2 md:px-3"
        >
          <ArrowLeft className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Back to Users</span>
        </Button>
      </div>

      {/* User Profile Card */}
      <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-4 md:p-6">
        <div className="flex flex-col gap-4 md:gap-6">
          {/* User Info */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl md:text-2xl font-semibold flex-shrink-0">
                {user.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)]">{user.name}</h1>
                {user.banned ? (
                  <span className="px-2 py-1 text-xs font-medium bg-red-500/20 text-red-400 rounded-full flex items-center gap-1">
                    <Ban className="h-3 w-3" />
                    Banned
                  </span>
                ) : user.emailVerified ? (
                  <span className="px-2 py-1 text-xs font-medium bg-green-500/20 text-green-400 rounded-full flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Verified
                  </span>
                ) : (
                  <span className="px-2 py-1 text-xs font-medium bg-yellow-500/20 text-yellow-400 rounded-full flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Unverified
                  </span>
                )}
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  user.role === 'admin' 
                    ? 'bg-blue-500/20 text-blue-400' 
                    : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {user.role}
                </span>
              </div>
              <p className="text-sm md:text-base text-[var(--text-secondary)] flex items-center gap-2 mt-1 truncate">
                <Mail className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{user.email}</span>
              </p>
              {user.username && (
                <p className="text-sm md:text-base text-[var(--text-secondary)] flex items-center gap-2 mt-1">
                  <User className="h-4 w-4 flex-shrink-0" />
                  @{user.username}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-xs md:text-sm text-[var(--text-secondary)]">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  Joined {formatDate(user.createdAt)}
                </span>
                {user.lastLoginAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    Last login {getTimeAgo(user.lastLoginAt)}
                  </span>
                )}
                {user.provider && (
                  <span className="flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    {user.provider}
                  </span>
                )}
              </div>
              {user.banned && user.banReason && (
                <div className="mt-3 p-2 md:p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs md:text-sm text-red-400">
                  <strong>Ban Reason:</strong> {user.banReason}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRoleDialogOpen(true)}
              className="border-blue-500 text-blue-400 hover:bg-blue-500/10 text-xs md:text-sm"
            >
              <Shield className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
              <span className="hidden sm:inline">Change </span>Role
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBanDialogOpen(true)}
              className={`text-xs md:text-sm ${user.banned 
                ? 'border-green-500 text-green-400 hover:bg-green-500/10'
                : 'border-yellow-500 text-yellow-400 hover:bg-yellow-500/10'
              }`}
            >
              {user.banned ? (
                <>
                  <CheckCircle className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
                  Unban
                </>
              ) : (
                <>
                  <Ban className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
                  Ban
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              className="border-red-500 text-red-400 hover:bg-red-500/10 text-xs md:text-sm"
            >
              <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {statsLoading || usageLoading ? (
        <StatsGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {overviewStats.map((stat) => {
            const IconComponent = stat.icon;
            return (
              <StatsCard
                key={stat.title}
                title={stat.title}
                value={stat.value}
                icon={<IconComponent className="h-5 w-5 text-blue-500" />}
                info={stat.info}
              />
            );
          })}
        </div>
      )}

      {/* Tabs - Horizontally scrollable on mobile */}
      <div className="border-b border-[var(--border-light)] overflow-x-auto scrollbar-hide">
        <nav className="flex gap-1 md:gap-4 min-w-max">
          {(['overview', 'conversations', 'usage', 'sessions', 'transactions'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 md:px-4 py-2.5 md:py-3 font-medium text-xs md:text-sm border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-400'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab === 'usage' ? 'Tokens' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-4 md:space-y-6">
          {/* Info Banner */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 md:p-4 flex items-start gap-2 md:gap-3">
            <Activity className="h-4 w-4 md:h-5 md:w-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs md:text-sm text-[var(--text-secondary)]">
              <span className="font-medium text-blue-400">Overview Summary:</span>{' '}
              This user has {totalConversations} conversation{totalConversations !== 1 ? 's' : ''} with {totalMessages} message{totalMessages !== 1 ? 's' : ''}, 
              consuming {(totalTokens / 1000).toFixed(1)}K tokens (${totalCost.toFixed(4)} estimated cost).
              {stats?.activityTimeline && stats.activityTimeline.length > 0 && (
                <span> Active on {stats.activityTimeline.length} day{stats.activityTimeline.length !== 1 ? 's' : ''} in the last 30 days.</span>
              )}
            </div>
          </div>

          {/* Activity Charts */}
          {stats?.activityTimeline && stats.activityTimeline.length > 0 && (
            <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-4 md:p-6">
              <h3 className="font-medium md:font-semibold text-sm md:text-base text-[var(--text-primary)] mb-3 md:mb-4">Activity Over Time</h3>
              <AreaChart
                data={stats.activityTimeline.map((d) => ({
                  name: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  value: d.count,
                }))}
                height={180}
                color="blue"
              />
            </div>
          )}

          {/* Model Usage */}
          {stats?.breakdowns?.byModel && stats.breakdowns.byModel.length > 0 && (
            <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-4 md:p-6">
              <h3 className="font-medium md:font-semibold text-sm md:text-base text-[var(--text-primary)] mb-3 md:mb-4">Model Usage</h3>
              <BarChart
                data={stats.breakdowns.byModel.map((m) => ({
                  name: m.model?.split('.').pop()?.split('-').slice(0, 2).join('-') || m.model,
                  value: m.count,
                }))}
                height={180}
              />
            </div>
          )}

          {/* Additional Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-4 md:p-6">
              <div className="flex items-center gap-2 mb-3 md:mb-4">
                <h3 className="font-medium md:font-semibold text-sm md:text-base text-[var(--text-primary)]">Usage Statistics</h3>
                <div className="group relative">
                  <Activity className="h-3.5 w-3.5 md:h-4 md:w-4 text-[var(--text-tertiary)] cursor-help" />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[var(--surface-tertiary)] text-xs text-[var(--text-secondary)] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-lg border border-[var(--border-light)]">
                    User engagement and activity metrics
                  </div>
                </div>
              </div>
              <dl className="space-y-2.5 md:space-y-3">
                <div className="flex justify-between text-xs md:text-sm">
                  <dt className="text-[var(--text-secondary)]">Avg Messages/Conversation</dt>
                  <dd className="font-medium text-[var(--text-primary)]">
                    {totalConversations > 0 ? (totalMessages / totalConversations).toFixed(1) : 0}
                  </dd>
                </div>
                <div className="flex justify-between text-xs md:text-sm">
                  <dt className="text-[var(--text-secondary)]">Avg Tokens/Message</dt>
                  <dd className="font-medium text-[var(--text-primary)]">
                    {totalMessages > 0 ? Math.round(totalTokens / totalMessages) : 0}
                  </dd>
                </div>
                <div className="flex justify-between text-xs md:text-sm">
                  <dt className="text-[var(--text-secondary)]">Active Days</dt>
                  <dd className="font-medium text-[var(--text-primary)]">
                    {stats?.activityTimeline?.length || 0}
                  </dd>
                </div>
                <div className="flex justify-between text-xs md:text-sm">
                  <dt className="text-[var(--text-secondary)]">Favorite Model</dt>
                  <dd className="font-medium text-[var(--text-primary)] text-right max-w-[50%] md:max-w-[60%] truncate" title={stats?.breakdowns?.byModel?.[0]?.model || 'N/A'}>
                    {stats?.breakdowns?.byModel?.[0]?.model?.split('.').pop()?.split('-').slice(0, 2).join('-') || 'N/A'}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-4 md:p-6">
              <div className="flex items-center gap-2 mb-3 md:mb-4">
                <h3 className="font-medium md:font-semibold text-sm md:text-base text-[var(--text-primary)]">Token Breakdown</h3>
                <div className="group relative">
                  <Zap className="h-3.5 w-3.5 md:h-4 md:w-4 text-[var(--text-tertiary)] cursor-help" />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[var(--surface-tertiary)] text-xs text-[var(--text-secondary)] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-lg border border-[var(--border-light)]">
                    Input = prompts sent, Output = responses received
                  </div>
                </div>
              </div>
              <div className="space-y-3 md:space-y-4">
                <div>
                  <div className="flex justify-between mb-1 text-xs md:text-sm">
                    <span className="text-[var(--text-secondary)]">Input Tokens</span>
                    <span className="text-[var(--text-primary)]">
                      {(inputTokens / 1000).toFixed(1)}K
                    </span>
                  </div>
                  <div className="h-1.5 md:h-2 bg-[var(--surface-primary-alt)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{
                        width: `${totalTokens > 0 ? (inputTokens / totalTokens) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1 text-xs md:text-sm">
                    <span className="text-[var(--text-secondary)]">Output Tokens</span>
                    <span className="text-[var(--text-primary)]">
                      {(outputTokens / 1000).toFixed(1)}K
                    </span>
                  </div>
                  <div className="h-1.5 md:h-2 bg-[var(--surface-primary-alt)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-600 rounded-full"
                      style={{
                        width: `${totalTokens > 0 ? (outputTokens / totalTokens) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'conversations' && (
        <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] overflow-hidden">
          <div className="p-3 md:p-4 border-b border-[var(--border-light)] bg-[var(--surface-secondary)]">
            <h3 className="text-sm md:text-base font-medium text-[var(--text-primary)]">
              Conversations ({conversationsLoading ? '...' : conversationsPagination.total})
            </h3>
            <p className="text-[10px] md:text-xs text-[var(--text-tertiary)] mt-0.5">Click on a conversation to view messages</p>
          </div>
          
          {conversationsLoading ? (
            <div className="p-4">
              <TableSkeleton rows={5} columns={2} showHeader={false} />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 md:py-12 text-[var(--text-secondary)] text-sm">
              No conversations found
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-light)]">
              {conversations.map((conv) => (
                <button
                  key={conv.conversationId}
                  onClick={() => {
                    setSelectedConversation(conv);
                    setConversationDrawerOpen(true);
                  }}
                  className="w-full p-3 md:p-4 flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors text-left group"
                >
                  <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                    <div className={`p-1.5 md:p-2 rounded-lg flex-shrink-0 ${conv.hasErrors ? 'bg-red-500/10' : 'bg-blue-500/10'}`}>
                      {conv.hasErrors ? (
                        <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-red-500" />
                      ) : (
                        <MessageSquare className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-xs md:text-sm text-[var(--text-primary)] truncate">{conv.title}</h4>
                        {conv.hasErrors && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-500/10 text-red-400 rounded flex-shrink-0">
                            {conv.errorCount} error{conv.errorCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] md:text-xs text-[var(--text-tertiary)] truncate">
                        {conv.messageCount} messages • {conv.model?.split('/').pop() || conv.endpoint}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                    <span className="text-[10px] md:text-xs text-[var(--text-tertiary)] hidden sm:block">
                      {formatDateTime(conv.updatedAt)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] transition-colors" />
                  </div>
                </button>
              ))}
              
              {/* Load More */}
              {conversationsPagination.hasNext && (
                <button
                  onClick={async () => {
                    try {
                      const nextPage = conversationsPagination.page + 1;
                      const response = await userDetailApi.getUserConversations(userId!, nextPage, 20);
                      setConversations(prev => [...prev, ...response.conversations]);
                      setConversationsPagination({
                        page: response.pagination.page,
                        total: response.pagination.total,
                        hasNext: response.pagination.hasNext,
                      });
                    } catch (err) {
                      console.error('Error loading more conversations:', err);
                    }
                  }}
                  className="w-full py-3 text-center text-xs md:text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Load more conversations...
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'usage' && (
        <div className="space-y-4 md:space-y-6">
          {usageLoading ? (
            <>
              {/* Usage Summary Cards Skeleton */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-3 md:p-6">
                    <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
                      <div className="h-8 w-8 rounded-lg bg-[var(--surface-primary-alt)] animate-pulse" />
                      <div className="h-4 w-12 bg-[var(--surface-primary-alt)] rounded animate-pulse" />
                    </div>
                    <div className="h-8 w-16 bg-[var(--surface-primary-alt)] rounded animate-pulse" />
                  </div>
                ))}
              </div>
              {/* Model Breakdown Table Skeleton */}
              <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] overflow-hidden p-4">
                <TableSkeleton rows={5} columns={6} />
              </div>
            </>
          ) : (
            <>
          {/* Usage Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
            <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-3 md:p-6">
              <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
                <div className="p-1.5 md:p-2 rounded-lg bg-blue-500/10">
                  <ArrowDownRight className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
                </div>
                <span className="text-xs md:text-sm text-[var(--text-secondary)]">Input</span>
              </div>
              <p className="text-lg md:text-2xl font-bold text-[var(--text-primary)]">
                {((usageData?.totals?.inputTokens || 0) / 1000).toFixed(1)}K
              </p>
            </div>
            <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-3 md:p-6">
              <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
                <div className="p-1.5 md:p-2 rounded-lg bg-green-500/10">
                  <ArrowUpRight className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
                </div>
                <span className="text-xs md:text-sm text-[var(--text-secondary)]">Output</span>
              </div>
              <p className="text-lg md:text-2xl font-bold text-[var(--text-primary)]">
                {((usageData?.totals?.outputTokens || 0) / 1000).toFixed(1)}K
              </p>
            </div>
            <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-3 md:p-6">
              <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
                <div className="p-1.5 md:p-2 rounded-lg bg-purple-500/10">
                  <Zap className="h-4 w-4 md:h-5 md:w-5 text-purple-500" />
                </div>
                <span className="text-xs md:text-sm text-[var(--text-secondary)]">Total</span>
              </div>
              <p className="text-lg md:text-2xl font-bold text-[var(--text-primary)]">
                {(((usageData?.totals?.inputTokens || 0) + (usageData?.totals?.outputTokens || 0)) / 1000).toFixed(1)}K
              </p>
            </div>
            <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-3 md:p-6">
              <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
                <div className="p-1.5 md:p-2 rounded-lg bg-yellow-500/10">
                  <Coins className="h-4 w-4 md:h-5 md:w-5 text-yellow-500" />
                </div>
                <span className="text-xs md:text-sm text-[var(--text-secondary)]">Cost</span>
              </div>
              <p className="text-lg md:text-2xl font-bold text-[var(--text-primary)]">
                ${(usageData?.totals?.totalCost || 0).toFixed(4)}
              </p>
            </div>
          </div>

          {/* Model Breakdown Table */}
          <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] overflow-hidden">
            <div className="p-3 md:p-4 border-b border-[var(--border-light)]">
              <h3 className="font-medium md:font-semibold text-sm md:text-base text-[var(--text-primary)] flex items-center gap-2">
                <Cpu className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
                Token Usage by Model
              </h3>
              <p className="text-xs md:text-sm text-[var(--text-secondary)] mt-1">
                Breakdown of token consumption per model
              </p>
            </div>
            {usageData?.byModel && usageData.byModel.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-[var(--surface-primary-alt)]">
                    <tr>
                      <th className="text-left px-3 md:px-4 py-2 md:py-3 text-[10px] md:text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Model</th>
                      <th className="text-right px-3 md:px-4 py-2 md:py-3 text-[10px] md:text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Input</th>
                      <th className="text-right px-3 md:px-4 py-2 md:py-3 text-[10px] md:text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Output</th>
                      <th className="text-right px-3 md:px-4 py-2 md:py-3 text-[10px] md:text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Total</th>
                      <th className="text-right px-3 md:px-4 py-2 md:py-3 text-[10px] md:text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Cost</th>
                      <th className="text-right px-3 md:px-4 py-2 md:py-3 text-[10px] md:text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Reqs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-light)]">
                    {usageData.byModel.map((model) => (
                      <tr key={model.model} className="hover:bg-[var(--surface-primary-alt)]">
                        <td className="px-3 md:px-4 py-2 md:py-3">
                          <div>
                            <p className="font-medium text-xs md:text-sm text-[var(--text-primary)] truncate max-w-[150px] md:max-w-none">{model.modelName || model.model}</p>
                            <p className="text-[10px] md:text-xs text-[var(--text-tertiary)] truncate max-w-[150px] md:max-w-none">{model.model}</p>
                          </div>
                        </td>
                        <td className="px-3 md:px-4 py-2 md:py-3 text-right">
                          <span className="flex items-center justify-end gap-1 text-xs md:text-sm text-[var(--text-secondary)]">
                            <ArrowDownRight className="h-2.5 w-2.5 md:h-3 md:w-3 text-blue-500" />
                            {(model.inputTokens / 1000).toFixed(1)}K
                          </span>
                        </td>
                        <td className="px-3 md:px-4 py-2 md:py-3 text-right">
                          <span className="flex items-center justify-end gap-1 text-xs md:text-sm text-[var(--text-secondary)]">
                            <ArrowUpRight className="h-2.5 w-2.5 md:h-3 md:w-3 text-green-500" />
                            {(model.outputTokens / 1000).toFixed(1)}K
                          </span>
                        </td>
                        <td className="px-3 md:px-4 py-2 md:py-3 text-right font-medium text-xs md:text-sm text-[var(--text-primary)]">
                          {((model.inputTokens + model.outputTokens) / 1000).toFixed(1)}K
                        </td>
                        <td className="px-3 md:px-4 py-2 md:py-3 text-right">
                          <span className="font-medium text-xs md:text-sm text-yellow-500">
                            ${model.totalCost.toFixed(4)}
                          </span>
                        </td>
                        <td className="px-3 md:px-4 py-2 md:py-3 text-right text-xs md:text-sm text-[var(--text-secondary)]">
                          {model.transactionCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-[var(--surface-primary-alt)] font-medium">
                    <tr>
                      <td className="px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm text-[var(--text-primary)]">Total</td>
                      <td className="px-3 md:px-4 py-2 md:py-3 text-right text-xs md:text-sm text-[var(--text-primary)]">
                        {((usageData?.totals?.inputTokens || 0) / 1000).toFixed(1)}K
                      </td>
                      <td className="px-3 md:px-4 py-2 md:py-3 text-right text-xs md:text-sm text-[var(--text-primary)]">
                        {((usageData?.totals?.outputTokens || 0) / 1000).toFixed(1)}K
                      </td>
                      <td className="px-3 md:px-4 py-2 md:py-3 text-right text-xs md:text-sm text-[var(--text-primary)]">
                        {(((usageData?.totals?.inputTokens || 0) + (usageData?.totals?.outputTokens || 0)) / 1000).toFixed(1)}K
                      </td>
                      <td className="px-3 md:px-4 py-2 md:py-3 text-right text-xs md:text-sm text-yellow-500">
                        ${(usageData?.totals?.totalCost || 0).toFixed(4)}
                      </td>
                      <td className="px-3 md:px-4 py-2 md:py-3 text-right text-xs md:text-sm text-[var(--text-primary)]">
                        {usageData?.totals?.transactionCount || 0}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-[var(--text-secondary)]">
                No usage data available for this user
              </div>
            )}
          </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'sessions' && (
        <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] overflow-hidden">
          <div className="p-3 md:p-4 border-b border-[var(--border-light)] flex items-center justify-between">
            <h3 className="font-medium md:font-semibold text-sm md:text-base text-[var(--text-primary)]">
              Sessions ({sessionsLoading ? '...' : sessions.length})
            </h3>
          </div>
          {sessionsLoading ? (
            <div className="p-4">
              <TableSkeleton rows={3} columns={3} showHeader={false} />
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-6 md:p-8 text-center text-[var(--text-secondary)] text-sm">
              No session history available
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-light)]">
              {sessions.map((session) => (
                <div
                  key={session.sessionId || session.id}
                  className="p-3 md:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start sm:items-center gap-3 md:gap-4">
                    <div className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-full flex-shrink-0 mt-1 sm:mt-0 ${session.isActive ? 'bg-green-500' : 'bg-gray-500'}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs md:text-sm text-[var(--text-primary)]">
                        <Monitor className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
                        <span className="truncate">{session.device || 'Unknown Device'} • {session.browser || 'Unknown Browser'}</span>
                      </div>
                      <div className="text-[10px] md:text-sm text-[var(--text-secondary)] flex flex-wrap items-center gap-x-2 md:gap-x-3 gap-y-1 mt-1">
                        <span className="flex items-center gap-1">
                          <Globe className="h-2.5 w-2.5 md:h-3 md:w-3" />
                          {session.ipAddress || 'Unknown IP'}
                        </span>
                        {(session.createdAt || session.startTime) && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5 md:h-3 md:w-3" />
                            Created {formatDateTime(session.createdAt || session.startTime || '')}
                          </span>
                        )}
                        {session.expiration && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5 md:h-3 md:w-3" />
                            Expires {formatDateTime(session.expiration)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {session.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTerminateSession(session.sessionId || session.id || '')}
                      disabled={terminatingSessionId === (session.sessionId || session.id)}
                      className="border-red-500 text-red-400 hover:bg-red-500/10 text-xs self-end sm:self-auto disabled:opacity-50"
                    >
                      {terminatingSessionId === (session.sessionId || session.id) ? 'Terminating...' : 'Terminate'}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] overflow-hidden">
          <div className="p-3 md:p-4 border-b border-[var(--border-light)] flex items-center justify-between">
            <h3 className="font-medium md:font-semibold text-sm md:text-base text-[var(--text-primary)]">
              Transactions ({transactionsLoading ? '...' : transactions.length})
            </h3>
            <Button variant="outline" size="sm" className="text-[var(--text-secondary)] text-xs">
              <Download className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
          {transactionsLoading ? (
            <div className="p-4">
              <TableSkeleton rows={4} columns={3} showHeader={false} />
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-6 md:p-8 text-center text-[var(--text-secondary)] text-sm">
              No transaction history available
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-light)]">
              {transactions.map((tx) => (
                <div
                  key={tx._id || tx.id}
                  className="p-3 md:p-4 flex items-start sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start sm:items-center gap-3 md:gap-4">
                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      tx.type === 'credit' || tx.type === 'refund' || tx.tokenType === 'credit'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {tx.type === 'credit' || tx.type === 'refund' || tx.tokenType === 'credit' ? (
                        <TrendingUp className="h-4 w-4 md:h-5 md:w-5" />
                      ) : (
                        <TrendingDown className="h-4 w-4 md:h-5 md:w-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs md:text-sm text-[var(--text-primary)] font-medium truncate">{tx.description || tx.context || tx.tokenType || 'Transaction'}</p>
                      <div className="text-[10px] md:text-sm text-[var(--text-secondary)] flex flex-wrap items-center gap-x-2 md:gap-x-3 gap-y-1">
                        <span>{formatDateTime(tx.createdAt)}</span>
                        {tx.model && <span className="truncate max-w-[100px] md:max-w-none">Model: {tx.model}</span>}
                        {tx.tokens && <span>{tx.tokens.toLocaleString()} tokens</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-xs md:text-sm font-semibold ${
                      tx.type === 'credit' || tx.type === 'refund' || tx.tokenType === 'credit' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {tx.type === 'credit' || tx.type === 'refund' || tx.tokenType === 'credit' ? '+' : '-'}
                      {tx.amount !== undefined ? `$${Math.abs(tx.amount).toFixed(4)}` : tx.rawAmount?.toLocaleString() || '0'}
                    </p>
                    {tx.balance !== undefined && (
                      <p className="text-[10px] md:text-sm text-[var(--text-secondary)]">
                        Bal: ${tx.balance.toFixed(4)}
                      </p>
                    )}
                    {tx.tokenValue !== undefined && (
                      <p className="text-[10px] md:text-sm text-[var(--text-secondary)]">
                        {tx.tokenValue.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ban Dialog */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent className="bg-[var(--surface-primary)] border-[var(--border-light)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">
              {user.banned ? 'Unban User' : 'Ban User'}
            </DialogTitle>
            <DialogDescription className="text-[var(--text-secondary)]">
              {user.banned
                ? `Are you sure you want to unban ${user.name}? They will be able to access the platform again.`
                : `Are you sure you want to ban ${user.name}? They will be logged out and unable to access the platform.`
              }
            </DialogDescription>
          </DialogHeader>
          {!user.banned && (
            <div className="space-y-2">
              <Label className="text-[var(--text-primary)]">Ban Reason</Label>
              <Input
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Enter reason for ban..."
                className="bg-[var(--surface-primary-alt)] border-[var(--border-light)]"
              />
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBanDialogOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBanUser}
              disabled={actionLoading}
              className={user.banned 
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
              }
            >
              {actionLoading ? <Spinner className="h-4 w-4" /> : user.banned ? 'Unban' : 'Ban'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="bg-[var(--surface-primary)] border-[var(--border-light)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">Change User Role</DialogTitle>
            <DialogDescription className="text-[var(--text-secondary)]">
              Select a new role for {user.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-[var(--text-primary)]">Role</Label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full p-2 rounded-md bg-[var(--surface-primary-alt)] border border-[var(--border-light)] text-[var(--text-primary)] [&>option]:bg-[var(--surface-primary)] [&>option]:text-[var(--text-primary)]"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRoleDialogOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRoleChange}
              disabled={actionLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {actionLoading ? <Spinner className="h-4 w-4" /> : 'Update Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-[var(--surface-primary)] border-[var(--border-light)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">Delete User</DialogTitle>
            <DialogDescription className="text-[var(--text-secondary)]">
              Are you sure you want to permanently delete {user.name}? This action cannot be undone.
              All user data, conversations, and history will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteUser}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {actionLoading ? <Spinner className="h-4 w-4" /> : 'Delete User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conversation Drawer */}
      <ConversationDrawer
        conversation={selectedConversation}
        isOpen={conversationDrawerOpen}
        onClose={() => {
          setConversationDrawerOpen(false);
          setSelectedConversation(null);
        }}
      />
    </div>
  );
}

export default UserDetailPage;
