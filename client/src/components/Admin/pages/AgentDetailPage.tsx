import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bot,
  Calendar,
  Users,
  User,
  MessageSquare,
  Coins,
  Clock,
  Globe,
  Lock,
  Zap,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  X,
  ChevronRight,
  AlertTriangle,
  Cpu,
  UserPlus,
  UserMinus,
} from 'lucide-react';
import {
  Button,
  Spinner,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@librechat/client';
import { StatsCard } from '../components/StatsCard';
import { AdminAreaChart as AreaChart } from '../components/Charts';
import { AgentDetailPageSkeleton, StatsGridSkeleton, TableSkeleton } from '../components/Skeletons';
import { agentDetailApi, groupsApi, usersApi, type AgentDetail, type AgentConversation, type AdminGroup, type User as UserType } from '../services/adminApi';
import { Input } from '@librechat/client';
import { Search, Plus } from 'lucide-react';

// Message type for lazy loading
interface ConversationMessage {
  messageId: string;
  text: string;
  sender: string;
  isCreatedByUser: boolean;
  model?: string;
  createdAt: string;
  tokenCount?: number;
  error?: boolean;
  isError?: boolean;
  errorMessage?: string | null;
}

// Conversation Drawer Component
interface ConversationDrawerProps {
  conversation: AgentConversation | null;
  isOpen: boolean;
  onClose: () => void;
}

function ConversationDrawer({ conversation, isOpen, onClose }: ConversationDrawerProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Fetch messages when conversation opens
  useEffect(() => {
    if (isOpen && conversation) {
      setLoadingMessages(true);
      agentDetailApi.getConversationMessages(conversation.conversationId)
        .then(res => {
          setMessages(res.messages || []);
        })
        .catch(err => {
          console.error('Failed to load messages:', err);
          setMessages([]);
        })
        .finally(() => setLoadingMessages(false));
    } else {
      setMessages([]);
    }
  }, [isOpen, conversation]);

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
          {conversation.user && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--surface-tertiary)] rounded-md">
              <User className="h-3 w-3 text-blue-400" />
              <span className="text-[10px] md:text-xs text-[var(--text-secondary)]">{conversation.user.name || conversation.user.email}</span>
            </div>
          )}
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
          {loadingMessages ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="h-6 w-6" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-tertiary)]">
              No messages in this conversation
            </div>
          ) : (
            messages.map((msg, idx) => (
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
          ))
          )}
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

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function AgentDetailPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  
  const [agentData, setAgentData] = useState<AgentDetail | null>(null);
  const [conversations, setConversations] = useState<AgentConversation[]>([]);
  const [conversationsPagination, setConversationsPagination] = useState<{ page: number; total: number; hasNext: boolean; totalPages: number }>({ page: 1, total: 0, hasNext: false, totalPages: 0 });
  const [selectedConversation, setSelectedConversation] = useState<AgentConversation | null>(null);
  const [conversationDrawerOpen, setConversationDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'conversations' | 'access'>('overview');
  
  // Access management dialogs
  const [groupsDialogOpen, setGroupsDialogOpen] = useState(false);
  const [usersDialogOpen, setUsersDialogOpen] = useState(false);
  
  // Editable access state
  const [editableGroups, setEditableGroups] = useState<string[]>([]); // group _ids
  const [editableUsers, setEditableUsers] = useState<string[]>([]); // user _ids
  const [accessSaving, setAccessSaving] = useState(false);
  
  // All available groups and users for selection
  const [allGroups, setAllGroups] = useState<AdminGroup[]>([]);
  const [allGroupsLoading, setAllGroupsLoading] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  
  // User search state
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<UserType[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);

  const fetchAgentData = useCallback(async () => {
    if (!agentId) return;
    
    try {
      setLoading(true);
      const data = await agentDetailApi.getAgentDetail(agentId);
      setAgentData(data);
      setError(null);
    } catch (err) {
      setError('Failed to load agent details');
      console.error('Error fetching agent details:', err);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  const fetchConversations = useCallback(async (page = 1) => {
    if (!agentId) return;
    
    try {
      setConversationsLoading(true);
      const response = await agentDetailApi.getAgentConversations(agentId, page, 20);
      setConversations(response.conversations || []);
      setConversationsPagination({
        page: response.pagination?.page || 1,
        total: response.pagination?.total || 0,
        hasNext: response.pagination?.hasNext || false,
        totalPages: response.pagination?.totalPages || 0,
      });
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setConversationsLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchAgentData();
  }, [fetchAgentData]);

  // Fetch all groups for selection
  const fetchAllGroups = useCallback(async () => {
    setAllGroupsLoading(true);
    try {
      const response = await groupsApi.getGroups();
      setAllGroups(response.groups || []);
    } catch (err) {
      console.error('Error fetching groups:', err);
    } finally {
      setAllGroupsLoading(false);
    }
  }, []);

  // Search users for selection
  const handleUserSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setUserSearchResults([]);
      return;
    }
    setUserSearchLoading(true);
    try {
      const response = await usersApi.list({ search: query, limit: 10 });
      // Filter out users already selected
      setUserSearchResults(response.users.filter(u => !editableUsers.includes(u._id)));
    } catch (err) {
      console.error('Error searching users:', err);
      setUserSearchResults([]);
    } finally {
      setUserSearchLoading(false);
    }
  }, [editableUsers]);

  // Debounced user search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (userSearchQuery) {
        handleUserSearch(userSearchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearchQuery, handleUserSearch]);

  // Open groups dialog and initialize state
  const openGroupsDialog = useCallback(() => {
    setEditableGroups(agentData?.groups.map(g => g._id) || []);
    fetchAllGroups();
    setGroupSearchQuery('');
    setGroupsDialogOpen(true);
  }, [agentData, fetchAllGroups]);

  // Open users dialog and initialize state
  const openUsersDialog = useCallback(() => {
    setEditableUsers(agentData?.users.map(u => u._id) || []);
    setUserSearchQuery('');
    setUserSearchResults([]);
    setUsersDialogOpen(true);
  }, [agentData]);

  // Save groups access
  const handleSaveGroupsAccess = useCallback(async () => {
    if (!agentId) return;
    setAccessSaving(true);
    try {
      await agentDetailApi.updateAgentAccess(agentId, {
        groups: editableGroups,
        users: agentData?.users.map(u => u._id) || [],
      });
      await fetchAgentData();
      setGroupsDialogOpen(false);
    } catch (err) {
      console.error('Error saving groups access:', err);
    } finally {
      setAccessSaving(false);
    }
  }, [agentId, editableGroups, agentData, fetchAgentData]);

  // Save users access
  const handleSaveUsersAccess = useCallback(async () => {
    if (!agentId) return;
    setAccessSaving(true);
    try {
      await agentDetailApi.updateAgentAccess(agentId, {
        groups: agentData?.groups.map(g => g._id) || [],
        users: editableUsers,
      });
      await fetchAgentData();
      setUsersDialogOpen(false);
    } catch (err) {
      console.error('Error saving users access:', err);
    } finally {
      setAccessSaving(false);
    }
  }, [agentId, editableUsers, agentData, fetchAgentData]);

  // Toggle group selection
  const toggleGroupSelection = (groupId: string) => {
    setEditableGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  // Add user to selection
  const addUserToSelection = (user: UserType) => {
    setEditableUsers(prev => [...prev, user._id]);
    setUserSearchQuery('');
    setUserSearchResults([]);
  };

  // Remove user from selection
  const removeUserFromSelection = (userId: string) => {
    setEditableUsers(prev => prev.filter(id => id !== userId));
  };

  const handleTabChange = useCallback((tab: typeof activeTab) => {
    setActiveTab(tab);
    if (tab === 'conversations' && conversations.length === 0) {
      fetchConversations();
    }
  }, [fetchConversations, conversations.length]);

  if (loading) {
    return <AgentDetailPageSkeleton />;
  }

  if (error || !agentData) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-red-400">
        <p>{error || 'Agent not found'}</p>
        <Button onClick={() => navigate('/admin/agents')} className="mt-4">
          Back to Agents
        </Button>
      </div>
    );
  }

  const { agent, stats, usageByDay, groups, users = [] } = agentData;

  const overviewStats = [
    {
      title: 'Total Conversations',
      value: formatNumber(stats.conversationCount),
      icon: <MessageSquare className="h-5 w-5" />,
      info: 'Total number of conversations using this agent',
    },
    {
      title: 'Unique Users',
      value: formatNumber(stats.userCount),
      icon: <Users className="h-5 w-5" />,
      info: 'Number of unique users who have used this agent',
    },
    {
      title: 'Total Tokens',
      value: `${(stats.totalTokens / 1000).toFixed(1)}K`,
      icon: <Zap className="h-5 w-5" />,
      info: `Input: ${(stats.inputTokens / 1000).toFixed(1)}K | Output: ${(stats.outputTokens / 1000).toFixed(1)}K`,
    },
    {
      title: 'Total Cost',
      value: `$${stats.totalCost.toFixed(4)}`,
      icon: <Coins className="h-5 w-5" />,
      info: `Input: $${stats.inputCost.toFixed(4)} | Output: $${stats.outputCost.toFixed(4)}`,
    },
  ];

  // Chart data for usage over time - use totalCost for simple area chart
  const chartData = usageByDay.map(d => ({
    name: d.date,
    value: d.inputCost + d.outputCost,
  }));

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-2 md:gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/admin/agents')}
          className="text-[var(--text-secondary)] px-2 md:px-3"
        >
          <ArrowLeft className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Back to Agents</span>
        </Button>
      </div>

      {/* Agent Profile Card */}
      <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-4 md:p-6">
        <div className="flex flex-col gap-4 md:gap-6">
          {/* Agent Info */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-blue-600 flex items-center justify-center text-white flex-shrink-0">
              <Bot className="h-8 w-8 md:h-10 md:w-10" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)]">{agent.name}</h1>
                {agent.isPublic ? (
                  <span className="px-2 py-1 text-xs font-medium bg-green-500/20 text-green-400 rounded-full flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    Public
                  </span>
                ) : (
                  <span className="px-2 py-1 text-xs font-medium bg-yellow-500/20 text-yellow-400 rounded-full flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    Private
                  </span>
                )}
                {/* Clickable Groups badge */}
                <button
                  onClick={openGroupsDialog}
                  className="px-2 py-1 text-xs font-medium bg-purple-500/20 text-purple-400 rounded-full flex items-center gap-1 hover:bg-purple-500/30 transition-colors cursor-pointer"
                >
                  <Users className="h-3 w-3" />
                  {groups.length} Group{groups.length !== 1 ? 's' : ''}
                </button>
                {/* Clickable Users badge */}
                <button
                  onClick={openUsersDialog}
                  className="px-2 py-1 text-xs font-medium bg-blue-500/20 text-blue-400 rounded-full flex items-center gap-1 hover:bg-blue-500/30 transition-colors cursor-pointer"
                >
                  <User className="h-3 w-3" />
                  {users.length} User{users.length !== 1 ? 's' : ''}
                </button>
              </div>
              {agent.description && (
                <p className="text-sm md:text-base text-[var(--text-secondary)] mt-2">
                  {agent.description}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-xs md:text-sm text-[var(--text-secondary)]">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  Created {formatDate(agent.createdAt)}
                </span>
                {agent.updatedAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    Updated {getTimeAgo(agent.updatedAt)}
                  </span>
                )}
                <span className="text-[var(--text-tertiary)] font-mono text-xs">
                  ID: {agent.id}
                </span>
              </div>
            </div>
            <div className="flex sm:flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchAgentData()}
                className="text-[var(--text-secondary)]"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--border-light)]">
        {(['overview', 'conversations', 'access'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === tab
                ? 'text-blue-400'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {overviewStats.map((stat) => (
              <StatsCard
                key={stat.title}
                title={stat.title}
                value={stat.value}
                icon={stat.icon}
                info={stat.info}
              />
            ))}
          </div>

          {/* Cost Breakdown */}
          <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-4 md:p-6">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Cost Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[var(--surface-secondary)] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUpRight className="h-4 w-4 text-green-400" />
                  <span className="text-sm text-[var(--text-secondary)]">Input Cost</span>
                </div>
                <p className="text-2xl font-bold text-green-400">${stats.inputCost.toFixed(4)}</p>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">{formatNumber(stats.inputTokens)} tokens</p>
              </div>
              <div className="bg-[var(--surface-secondary)] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowDownRight className="h-4 w-4 text-blue-400" />
                  <span className="text-sm text-[var(--text-secondary)]">Output Cost</span>
                </div>
                <p className="text-2xl font-bold text-blue-400">${stats.outputCost.toFixed(4)}</p>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">{formatNumber(stats.outputTokens)} tokens</p>
              </div>
              <div className="bg-[var(--surface-secondary)] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="h-4 w-4 text-purple-400" />
                  <span className="text-sm text-[var(--text-secondary)]">Total Cost</span>
                </div>
                <p className="text-2xl font-bold text-purple-400">${stats.totalCost.toFixed(4)}</p>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">{stats.transactions} transactions</p>
              </div>
            </div>
          </div>

          {/* Usage Chart */}
          {chartData.length > 0 && (
            <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-4 md:p-6">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Cost Over Time</h3>
              <div className="h-64">
                <AreaChart
                  data={chartData}
                  height={256}
                  color="#8b5cf6"
                  formatter={(v) => `$${v.toFixed(4)}`}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'conversations' && (
        <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border-light)]">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              Conversations ({conversationsPagination.total})
            </h3>
          </div>
          
          {conversationsLoading ? (
            <div className="divide-y divide-[var(--border-light)]">
              {[...Array(5)].map((_, idx) => (
                <div key={idx} className="p-3 md:p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-[var(--surface-tertiary)] animate-pulse" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="h-4 w-48 bg-[var(--surface-tertiary)] rounded animate-pulse" />
                      <div className="h-3 w-32 bg-[var(--surface-tertiary)] rounded animate-pulse" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-24 bg-[var(--surface-tertiary)] rounded animate-pulse hidden sm:block" />
                    <div className="h-4 w-4 bg-[var(--surface-tertiary)] rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-secondary)]">
              No conversations found for this agent
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
                        {conv.user && ` • ${conv.user.name || conv.user.email}`}
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
            </div>
          )}

          {/* Pagination */}
          {conversationsPagination.total > 20 && (
            <div className="p-4 border-t border-[var(--border-light)] flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">
                Page {conversationsPagination.page} of {Math.ceil(conversationsPagination.total / 20)}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={conversationsPagination.page <= 1 || conversationsLoading}
                  onClick={() => fetchConversations(conversationsPagination.page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!conversationsPagination.hasNext || conversationsLoading}
                  onClick={() => fetchConversations(conversationsPagination.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'access' && (
        <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border-light)]">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              Access Groups ({groups.length})
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {agent.isPublic
                ? 'This agent is public and available to all users.'
                : 'Groups that have access to this agent.'}
            </p>
          </div>
          
          {/* Groups Section */}
          <div className="p-4 border-b border-[var(--border-light)]">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-[var(--text-primary)]">Groups ({groups.length})</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={openGroupsDialog}
                className="text-xs"
              >
                <UserPlus className="h-3.5 w-3.5 mr-1" />
                Manage Groups
              </Button>
            </div>
          </div>
          
          {groups.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-secondary)] text-sm">
              {agent.isPublic
                ? 'Public agent - accessible by all users'
                : 'No groups assigned'}
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-light)]">
              {groups.map((group) => (
                <div
                  key={group._id}
                  className="p-4 hover:bg-[var(--surface-secondary)] transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <Users className="h-5 w-5 text-purple-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-[var(--text-primary)]">{group.name}</h4>
                        {group.description && (
                          <p className="text-sm text-[var(--text-secondary)]">{group.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        group.source === 'entra'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {group.source === 'entra' ? 'Entra ID' : 'Local'}
                      </span>
                      <span className="text-sm text-[var(--text-secondary)]">
                        {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Users Section */}
          <div className="p-4 border-t border-b border-[var(--border-light)]">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-[var(--text-primary)]">Individual Users ({users.length})</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={openUsersDialog}
                className="text-xs"
              >
                <UserPlus className="h-3.5 w-3.5 mr-1" />
                Manage Users
              </Button>
            </div>
          </div>
          
          {users.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-secondary)] text-sm">
              No individual users with direct access
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-light)]">
              {users.map((u) => (
                <div
                  key={u._id}
                  className="p-4 hover:bg-[var(--surface-secondary)] transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        {u.avatar ? (
                          <img src={u.avatar} alt={u.name} className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <User className="h-5 w-5 text-blue-400" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-[var(--text-primary)]">{u.name}</h4>
                        <p className="text-sm text-[var(--text-secondary)]">{u.email}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Groups Management Dialog */}
      <Dialog open={groupsDialogOpen} onOpenChange={setGroupsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Group Access</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4 space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Select which groups can access this agent.
            </p>
            
            {/* Group Search/Filter */}
            <div className="relative">
              <div className="flex items-center border border-[var(--border-light)] rounded-lg bg-[var(--surface-secondary)] px-3">
                <Search className="h-4 w-4 text-text-tertiary mr-2" />
                <input
                  type="text"
                  value={groupSearchQuery}
                  onChange={(e) => setGroupSearchQuery(e.target.value)}
                  placeholder="Filter groups..."
                  className="flex-1 py-2 bg-transparent text-text-primary placeholder:text-text-tertiary focus:outline-none text-sm"
                />
              </div>
            </div>

            {/* Groups List with Checkboxes */}
            {allGroupsLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-5 w-5 text-text-tertiary animate-spin" />
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {allGroups
                  .filter(g => !groupSearchQuery || g.name.toLowerCase().includes(groupSearchQuery.toLowerCase()))
                  .map((group) => {
                    const isSelected = editableGroups.includes(group._id);
                    return (
                      <button
                        key={group._id}
                        onClick={() => toggleGroupSelection(group._id)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                          isSelected 
                            ? 'bg-purple-500/20 border border-purple-500/50' 
                            : 'bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)] border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            isSelected ? 'bg-purple-500 border-purple-500' : 'border-[var(--border-light)]'
                          }`}>
                            {isSelected && <span className="text-white text-xs">✓</span>}
                          </div>
                          <Users className="h-4 w-4 text-purple-400" />
                          <span className="text-sm text-[var(--text-primary)]">{group.name}</span>
                        </div>
                        <span className="text-xs text-[var(--text-tertiary)]">
                          {group.userCount || 0} members
                        </span>
                      </button>
                    );
                  })}
                {allGroups.length === 0 && (
                  <p className="text-sm text-[var(--text-tertiary)] text-center py-4">
                    No groups available. Create groups from the Roles & Groups page.
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setGroupsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveGroupsAccess} disabled={accessSaving}>
              {accessSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Users Management Dialog */}
      <Dialog open={usersDialogOpen} onOpenChange={setUsersDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage User Access</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4 space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Add or remove individual users who can access this agent.
            </p>
            
            {/* User Search */}
            <div className="relative">
              <div className="flex items-center border border-[var(--border-light)] rounded-lg bg-[var(--surface-secondary)] px-3">
                <Search className="h-4 w-4 text-text-tertiary mr-2" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Search users by name or email..."
                  className="flex-1 py-2 bg-transparent text-text-primary placeholder:text-text-tertiary focus:outline-none text-sm"
                />
                {userSearchLoading && <RefreshCw className="h-4 w-4 text-text-tertiary animate-spin" />}
              </div>
              
              {/* Search Results Dropdown */}
              {userSearchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--surface-secondary)] border border-[var(--border-light)] rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  {userSearchResults.map((u) => (
                    <button
                      key={u._id}
                      onClick={() => addUserToSelection(u)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[var(--surface-tertiary)] transition-colors text-left"
                    >
                      {u.avatar ? (
                        <img src={u.avatar} alt={u.name} className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <User className="h-3 w-3 text-blue-400" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-text-primary truncate">{u.name}</p>
                        <p className="text-xs text-text-tertiary truncate">{u.email}</p>
                      </div>
                      <Plus className="h-4 w-4 text-text-tertiary flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Users List */}
            <div>
              <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2">
                Users with Access ({editableUsers.length})
              </h4>
              {editableUsers.length === 0 ? (
                <p className="text-sm text-[var(--text-tertiary)] text-center py-4">
                  No individual users with direct access. Search above to add users.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {editableUsers.map((userId) => {
                    // Find user from original users list or search results
                    const u = users.find(user => user._id === userId) || 
                              userSearchResults.find(user => user._id === userId);
                    if (!u) {
                      // User ID exists but details not loaded - show placeholder
                      return (
                        <div key={userId} className="flex items-center justify-between p-2 bg-[var(--surface-tertiary)] rounded-lg">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-blue-400" />
                            <span className="text-sm text-text-tertiary">{userId}</span>
                          </div>
                          <button
                            onClick={() => removeUserFromSelection(userId)}
                            className="p-1 hover:bg-red-500/20 rounded transition-colors"
                          >
                            <UserMinus className="h-4 w-4 text-red-400" />
                          </button>
                        </div>
                      );
                    }
                    return (
                      <div key={userId} className="flex items-center justify-between p-2 bg-[var(--surface-tertiary)] rounded-lg">
                        <div className="flex items-center gap-2 min-w-0">
                          {u.avatar ? (
                            <img src={u.avatar} alt={u.name} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                              <User className="h-3 w-3 text-blue-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm text-text-primary truncate">{u.name || u.email}</p>
                            {u.name && <p className="text-xs text-text-tertiary truncate">{u.email}</p>}
                          </div>
                        </div>
                        <button
                          onClick={() => removeUserFromSelection(userId)}
                          className="p-1 hover:bg-red-500/20 rounded transition-colors flex-shrink-0"
                          title="Remove access"
                        >
                          <UserMinus className="h-4 w-4 text-red-400" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setUsersDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveUsersAccess} disabled={accessSaving}>
              {accessSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Save Changes'}
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

export default AgentDetailPage;
