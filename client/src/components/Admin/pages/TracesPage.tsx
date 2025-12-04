import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import remarkGfm from 'remark-gfm';
import ReactMarkdown from 'react-markdown';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Brain,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  DollarSign,
  MessageCircle,
  RefreshCw,
  Search,
  Sparkles,
  User,
  Users,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { Button, Spinner } from '@librechat/client';
import { tracesApi, usersApi, type LLMTrace, type LLMTracesResponse } from '../services/adminApi';

// Drawer component for trace details
interface TraceDrawerProps {
  trace: LLMTrace | null;
  isOpen: boolean;
  onClose: () => void;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

// Tree node for trace flow
interface TreeNode {
  id: string;
  label: string;
  type: 'trace' | 'thinking' | 'tool' | 'request' | 'response';
  icon: React.ReactNode;
  color: string;
  children?: TreeNode[];
  data?: unknown;
}

function TraceDrawer({ trace, isOpen, onClose }: TraceDrawerProps) {
  const [selectedNode, setSelectedNode] = useState<string>('trace');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['trace']));

  // Reset selection when trace changes
  useEffect(() => {
    if (trace) {
      setSelectedNode('trace');
      setExpandedNodes(new Set(['trace']));
    }
  }, [trace?.id]);

  if (!isOpen || !trace) return null;

  const formatCost = (cost: number) => `$${cost.toFixed(6)}`;
  const formatTokens = (tokens: number) => tokens.toLocaleString();
  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Build hierarchical tree
  const buildTree = (): TreeNode => {
    const traceNode: TreeNode = {
      id: 'trace',
      label: 'LLM Trace',
      type: 'trace',
      icon: <Activity className="h-3.5 w-3.5" />,
      color: 'text-blue-400',
      children: [],
    };

    // Add request as child
    traceNode.children?.push({
      id: 'request',
      label: 'Request',
      type: 'request',
      icon: <ArrowDownRight className="h-3.5 w-3.5" />,
      color: 'text-blue-400',
      data: trace.input,
    });

    // Add thinking if present (as child of trace)
    if (trace.trace.thinking) {
      traceNode.children?.push({
        id: 'thinking',
        label: 'Extended Thinking',
        type: 'thinking',
        icon: <Brain className="h-3.5 w-3.5" />,
        color: 'text-purple-400',
        data: trace.trace.thinking,
      });
    }

    // Add tool calls if present
    if (trace.trace.toolCalls && trace.trace.toolCalls.length > 0) {
      trace.trace.toolCalls.forEach((tool, idx) => {
        traceNode.children?.push({
          id: `tool-${idx}`,
          label: tool.name || `Tool ${idx + 1}`,
          type: 'tool',
          icon: <Wrench className="h-3.5 w-3.5" />,
          color: 'text-orange-400',
          data: tool,
        });
      });
    }

    // Add response as child
    traceNode.children?.push({
      id: 'response',
      label: 'Response',
      type: 'response',
      icon: <ArrowUpRight className="h-3.5 w-3.5" />,
      color: 'text-green-400',
      data: trace.output,
    });

    return traceNode;
  };

  const tree = buildTree();

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Recursive tree renderer
  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = selectedNode === node.id;
    const hasChildren = node.children && node.children.length > 0;
    const indent = depth * 16;

    return (
      <div key={node.id}>
        <button
          onClick={() => {
            setSelectedNode(node.id);
            if (hasChildren) {
              toggleNode(node.id);
            }
          }}
          className={`w-full flex items-center gap-1.5 py-1.5 px-2 text-left text-sm transition-colors rounded ${
            isSelected
              ? 'bg-blue-500/20 text-blue-400'
              : 'hover:bg-[var(--surface-secondary)] text-[var(--text-secondary)]'
          }`}
          style={{ paddingLeft: `${8 + indent}px` }}
        >
          {/* Expand/collapse icon */}
          {hasChildren ? (
            <span className="text-[var(--text-tertiary)]">
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </span>
          ) : (
            <span className="w-3.5" />
          )}
          
          {/* Node icon */}
          <span className={node.color}>{node.icon}</span>
          
          {/* Label */}
          <span className="truncate flex-1">{node.label}</span>
          
          {/* Badge for tool/thinking */}
          {node.type === 'tool' && (
            <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded">Tool</span>
          )}
          {node.type === 'thinking' && (
            <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">Think</span>
          )}
        </button>
        
        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="relative">
            {/* Vertical line */}
            <div 
              className="absolute top-0 bottom-2 w-px bg-[var(--border-light)]" 
              style={{ left: `${16 + indent}px` }}
            />
            {node.children?.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Find selected node data
  const findNode = (node: TreeNode, id: string): TreeNode | null => {
    if (node.id === id) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = findNode(child, id);
        if (found) return found;
      }
    }
    return null;
  };

  const selectedNodeData = findNode(tree, selectedNode);

  // Render content based on selected node
  const renderContent = () => {
    if (!selectedNodeData) return null;

    switch (selectedNodeData.type) {
      case 'trace':
        // Show both request and response summary
        return (
          <div className="space-y-4 md:space-y-6">
            {/* Request Section */}
            <div>
              <div className="flex items-center gap-2 mb-2 md:mb-3">
                <div className="flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded bg-blue-500/20">
                  <ArrowDownRight className="h-3 w-3 md:h-4 md:w-4 text-blue-400" />
                </div>
                <h3 className="font-medium text-[var(--text-primary)] text-xs md:text-sm">Request</h3>
              </div>
              <div className="bg-[var(--surface-secondary)] rounded-lg p-3 md:p-4 border border-[var(--border-light)]">
                <div className="prose prose-sm dark:prose-invert max-w-none text-xs md:text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {trace.input?.text || '_No input text_'}
                  </ReactMarkdown>
                </div>
              </div>
            </div>

            {/* Response Section */}
            <div>
              <div className="flex items-center gap-2 mb-2 md:mb-3">
                <div className="flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded bg-green-500/20">
                  <ArrowUpRight className="h-3 w-3 md:h-4 md:w-4 text-green-400" />
                </div>
                <h3 className="font-medium text-[var(--text-primary)] text-xs md:text-sm">Response</h3>
              </div>
              <div className="bg-[var(--surface-secondary)] rounded-lg p-3 md:p-4 border border-[var(--border-light)]">
                <div className="prose prose-sm dark:prose-invert max-w-none text-xs md:text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {trace.output?.text || '_No output text_'}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        );

      case 'request':
        return (
          <div className="space-y-3 md:space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded bg-blue-500/20">
                <User className="h-3 w-3 md:h-4 md:w-4 text-blue-400" />
              </div>
              <div>
                <h3 className="font-medium text-[var(--text-primary)] text-xs md:text-sm">User Input</h3>
                <p className="text-[10px] md:text-xs text-[var(--text-tertiary)]">
                  {trace.user?.name || 'Unknown'} • {new Date(trace.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="bg-[var(--surface-secondary)] rounded-lg p-3 md:p-4 border border-[var(--border-light)]">
              <div className="prose prose-sm dark:prose-invert max-w-none text-xs md:text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {trace.input?.text || '_No input text_'}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        );

      case 'response':
        return (
          <div className="space-y-3 md:space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded bg-green-500/20">
                <Sparkles className="h-3 w-3 md:h-4 md:w-4 text-green-400" />
              </div>
              <div>
                <h3 className="font-medium text-[var(--text-primary)] text-xs md:text-sm">AI Response</h3>
                <p className="text-[10px] md:text-xs text-[var(--text-tertiary)]">
                  {trace.trace.modelName} • {trace.output?.tokenCount || 0} tokens
                </p>
              </div>
            </div>
            <div className="bg-[var(--surface-secondary)] rounded-lg p-3 md:p-4 border border-[var(--border-light)]">
              <div className="prose prose-sm dark:prose-invert max-w-none text-xs md:text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {trace.output?.text || '_No output text_'}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        );

      case 'thinking':
        return (
          <div className="space-y-3 md:space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded bg-purple-500/20">
                <Brain className="h-3 w-3 md:h-4 md:w-4 text-purple-400" />
              </div>
              <div>
                <h3 className="font-medium text-[var(--text-primary)] text-xs md:text-sm">Extended Thinking</h3>
                <p className="text-[10px] md:text-xs text-[var(--text-tertiary)]">Internal reasoning process</p>
              </div>
            </div>
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3 md:p-4">
              <pre className="text-xs md:text-sm text-[var(--text-secondary)] whitespace-pre-wrap font-mono overflow-auto">
                {trace.trace.thinking}
              </pre>
            </div>
          </div>
        );

      case 'tool':
        const tool = selectedNodeData.data as { id?: string; name?: string; args?: unknown; output?: string };
        return (
          <div className="space-y-3 md:space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded bg-orange-500/20">
                <Wrench className="h-3 w-3 md:h-4 md:w-4 text-orange-400" />
              </div>
              <div>
                <h3 className="font-medium text-[var(--text-primary)] text-xs md:text-sm">{tool.name}</h3>
                <p className="text-[10px] md:text-xs text-[var(--text-tertiary)] font-mono">{tool.id}</p>
              </div>
            </div>
            
            {/* Arguments */}
            <div>
              <h4 className="text-[10px] md:text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5 md:mb-2">Arguments</h4>
              <div className="bg-[var(--surface-secondary)] rounded-lg p-2.5 md:p-3 border border-[var(--border-light)] overflow-auto max-h-48">
                <pre className="text-[10px] md:text-xs text-[var(--text-secondary)] font-mono">
                  {typeof tool.args === 'string' ? tool.args : JSON.stringify(tool.args, null, 2)}
                </pre>
              </div>
            </div>
            
            {/* Output */}
            {tool.output && (
              <div>
                <h4 className="text-[10px] md:text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5 md:mb-2">Output</h4>
                <div className="bg-[var(--surface-secondary)] rounded-lg p-2.5 md:p-3 border border-[var(--border-light)] overflow-auto max-h-64">
                  <pre className="text-[10px] md:text-xs text-[var(--text-secondary)] font-mono whitespace-pre-wrap">
                    {tool.output}
                  </pre>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // Use portal to render drawer at document body level
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
        className="fixed right-0 top-0 h-screen w-full md:w-1/2 md:min-w-[600px] md:max-w-[900px] bg-[var(--surface-primary)] border-l border-[var(--border-light)] flex flex-col shadow-2xl"
        style={{ zIndex: 9999 }}
      >
        {/* Header Row 1 - Title and Close */}
        <div className="flex items-center justify-between px-3 md:px-4 py-2 border-b border-[var(--border-light)] bg-[var(--surface-secondary)]">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-lg bg-blue-500/20">
              <Activity className="h-3.5 w-3.5 md:h-4 md:w-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-medium text-[var(--text-primary)]">Trace Details</h2>
              <p className="text-[10px] md:text-xs text-[var(--text-tertiary)] font-mono truncate max-w-[180px] md:max-w-none">{trace.messageId}</p>
            </div>
          </div>
          
          {/* Duration badge */}
          <div className="flex items-center gap-2 md:gap-3">
            <div className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full">
              <Clock className="h-3 w-3 md:h-3.5 md:w-3.5 text-purple-400" />
              <span className="text-xs md:text-sm font-medium text-purple-400">{formatDuration(trace.trace.duration)}</span>
            </div>
            <button 
              onClick={onClose}
              className="p-1 md:p-1.5 hover:bg-[var(--surface-tertiary)] rounded-lg transition-colors"
            >
              <X className="h-4 w-4 md:h-5 md:w-5 text-[var(--text-secondary)]" />
            </button>
          </div>
        </div>
        
        {/* Header Row 2 - Stats Badges */}
        <div className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 border-b border-[var(--border-light)] bg-[var(--surface-secondary)]/50 flex-wrap overflow-x-auto">
          {/* Model Badge */}
          <div className="flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-0.5 md:py-1 bg-blue-500/10 border border-blue-500/20 rounded-md">
            <Cpu className="h-3 w-3 md:h-3.5 md:w-3.5 text-blue-400" />
            <span className="text-[10px] md:text-xs font-medium text-blue-400 truncate max-w-[100px] md:max-w-none">{trace.trace.modelName}</span>
          </div>
          
          {/* Input Tokens Badge */}
          <div className="flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-0.5 md:py-1 bg-[var(--surface-tertiary)] rounded-md">
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-blue-500" />
            <span className="text-[10px] md:text-xs text-[var(--text-secondary)]">{formatTokens(trace.trace.inputTokens)}</span>
            <span className="text-[9px] md:text-[10px] text-[var(--text-tertiary)] hidden md:inline">input</span>
          </div>
          
          {/* Output Tokens Badge */}
          <div className="flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-0.5 md:py-1 bg-[var(--surface-tertiary)] rounded-md">
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-green-500" />
            <span className="text-[10px] md:text-xs text-[var(--text-secondary)]">{formatTokens(trace.trace.outputTokens)}</span>
            <span className="text-[9px] md:text-[10px] text-[var(--text-tertiary)] hidden md:inline">output</span>
          </div>
          
          {/* Total Tokens Badge */}
          <div className="flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-0.5 md:py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
            <Zap className="h-3 w-3 md:h-3.5 md:w-3.5 text-yellow-500" />
            <span className="text-[10px] md:text-xs font-medium text-yellow-500">{formatTokens(trace.trace.totalTokens)}</span>
          </div>
          
          {/* Cost Badge */}
          <div className="flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-0.5 md:py-1 bg-green-500/10 border border-green-500/20 rounded-md">
            <DollarSign className="h-3 w-3 md:h-3.5 md:w-3.5 text-green-500" />
            <span className="text-[10px] md:text-xs font-medium text-green-500">{formatCost(trace.trace.totalCost)}</span>
          </div>
          
          {/* Token bar - fills remaining space, hidden on mobile */}
          <div className="hidden md:flex flex-1 min-w-[80px] h-1.5 bg-[var(--surface-tertiary)] rounded-full overflow-hidden ml-2">
            <div
              className="h-full bg-blue-500"
              style={{ width: `${trace.trace.totalTokens > 0 ? (trace.trace.inputTokens / trace.trace.totalTokens) * 100 : 0}%` }}
            />
            <div
              className="h-full bg-green-500"
              style={{ width: `${trace.trace.totalTokens > 0 ? (trace.trace.outputTokens / trace.trace.totalTokens) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Main Content - Split View on desktop, stacked on mobile */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* Left Navigation Tree - Collapsible on mobile */}
          <div className="md:w-56 lg:w-64 flex flex-col border-b md:border-b-0 md:border-r border-[var(--border-light)] bg-[var(--surface-secondary)]/30">
            {/* Tree */}
            <div className="flex-1 overflow-y-auto p-2 md:p-3 max-h-[200px] md:max-h-none">
              <div className="text-[9px] md:text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider px-2 py-1 mb-1">
                Trace Flow
              </div>
              {renderTreeNode(tree)}
            </div>
            
            {/* Metadata in left sidebar bottom - hidden on mobile, shown inline */}
            <div className="hidden md:block p-2 md:p-3 border-t border-[var(--border-light)] bg-[var(--surface-secondary)]/70">
              <div className="space-y-2">
                <div>
                  <span className="text-[9px] md:text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Conversation</span>
                  <p className="text-xs md:text-sm text-[var(--text-primary)] truncate" title={trace.conversationTitle}>
                    {trace.conversationTitle}
                  </p>
                </div>
                <div>
                  <span className="text-[9px] md:text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">User</span>
                  <p className="text-xs md:text-sm text-[var(--text-primary)]">{trace.user?.name || 'Unknown'}</p>
                </div>
                <div>
                  <span className="text-[9px] md:text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Timestamp</span>
                  <p className="text-xs md:text-sm text-[var(--text-primary)]">{new Date(trace.createdAt).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Content Panel */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3 md:p-5">
              {renderContent()}
            </div>

            {/* Footer with model ID */}
            <div className="px-3 md:px-4 py-1.5 md:py-2 border-t border-[var(--border-light)] bg-[var(--surface-secondary)]/50">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 md:gap-0 text-[10px] md:text-xs">
                <div className="flex items-center gap-1 md:gap-2">
                  <span className="text-[var(--text-tertiary)]">Model ID:</span>
                  <code className="text-[9px] md:text-[10px] text-[var(--text-secondary)] font-mono bg-[var(--surface-tertiary)] px-1.5 md:px-2 py-0.5 rounded truncate max-w-[200px] md:max-w-none">
                    {trace.trace.model}
                  </code>
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                  <span className="text-[var(--text-tertiary)]">Endpoint:</span>
                  <span className="text-[var(--text-secondary)]">{trace.trace.endpoint}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

// Main TracesPage component
export function TracesPage() {
  const [data, setData] = useState<LLMTracesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrace, setSelectedTrace] = useState<LLMTrace | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  // User list for filter
  const [users, setUsers] = useState<UserOption[]>([]);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [conversationIdFilter, setConversationIdFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  // Fetch users for filter dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await usersApi.list({ limit: 500 });
        setUsers(
          response.users.map(u => ({
            id: u._id,
            name: u.name || u.username || 'Unknown',
            email: u.email,
          }))
        );
      } catch (err) {
        console.error('Failed to fetch users for filter:', err);
      }
    };
    fetchUsers();
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await tracesApi.getTraces({
        page,
        limit: 50,
        model: selectedModel || undefined,
        userId: selectedUserId || undefined,
        conversationId: conversationIdFilter || undefined,
      });
      setData(response);
      setError(null);
    } catch (err) {
      setError('Failed to load traces');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, selectedModel, selectedUserId, conversationIdFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openDrawer = (trace: LLMTrace) => {
    setSelectedTrace(trace);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedTrace(null);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const truncateText = (text: string, maxLen: number = 80) => {
    if (!text) return '';
    return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
  };

  // Filter traces by search query (local filter on top of server filters)
  const filteredTraces = (data?.traces || []).filter(trace => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (trace.input?.text || '').toLowerCase().includes(query) ||
      (trace.output?.text || '').toLowerCase().includes(query) ||
      (trace.conversationTitle || '').toLowerCase().includes(query) ||
      trace.user?.name?.toLowerCase().includes(query) ||
      trace.user?.email?.toLowerCase().includes(query) ||
      trace.conversationId?.toLowerCase().includes(query)
    );
  });

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedModel('');
    setSelectedUserId('');
    setConversationIdFilter('');
    setPage(1);
  };

  const hasActiveFilters = selectedModel || selectedUserId || conversationIdFilter || searchQuery;

  return (
    <div className="space-y-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Activity className="h-7 w-7 text-blue-500" />
            LLM Observability
          </h1>
          <p className="text-[var(--text-secondary)] mt-1">
            Monitor all LLM traces with input/output pairs, token usage, and costs
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchData}
          disabled={loading}
          className="border-[var(--border-light)]"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
                <Activity className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{(data.summary?.totalTraces || 0).toLocaleString()}</p>
                <p className="text-sm text-[var(--text-secondary)]">Total Traces</p>
              </div>
            </div>
          </div>
          <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
                <Cpu className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{(data.filters?.models || []).length}</p>
                <p className="text-sm text-[var(--text-secondary)]">Models Used</p>
              </div>
            </div>
          </div>
          <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/20">
                <Zap className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {filteredTraces.reduce((sum, t) => sum + (t.trace?.totalTokens || 0), 0).toLocaleString()}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">Tokens (This Page)</p>
              </div>
            </div>
          </div>
          <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20">
                <DollarSign className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  ${filteredTraces.reduce((sum, t) => sum + (t.trace?.totalCost || 0), 0).toFixed(4)}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">Cost (This Page)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)]" />
              <input
                type="text"
                placeholder="Search by content, user, or conversation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[var(--surface-secondary)] border border-[var(--border-light)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {/* User Filter */}
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[var(--text-tertiary)]" />
              <select
                value={selectedUserId}
                onChange={(e) => { setSelectedUserId(e.target.value); setPage(1); }}
                className="px-3 py-2 bg-[var(--surface-secondary)] border border-[var(--border-light)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-[var(--surface-primary)] [&>option]:text-[var(--text-primary)] min-w-[180px]"
              >
                <option value="">All Users</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
                ))}
              </select>
            </div>
            
            {/* Model Filter */}
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-[var(--text-tertiary)]" />
              <select
                value={selectedModel}
                onChange={(e) => { setSelectedModel(e.target.value); setPage(1); }}
                className="px-3 py-2 bg-[var(--surface-secondary)] border border-[var(--border-light)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-[var(--surface-primary)] [&>option]:text-[var(--text-primary)] min-w-[150px]"
              >
                <option value="">All Models</option>
                {(data?.filters?.models || []).map(model => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Conversation ID Filter */}
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="flex items-center gap-2 flex-1">
              <MessageCircle className="h-4 w-4 text-[var(--text-tertiary)]" />
              <input
                type="text"
                placeholder="Filter by Conversation ID..."
                value={conversationIdFilter}
                onChange={(e) => { setConversationIdFilter(e.target.value); setPage(1); }}
                className="flex-1 max-w-md px-3 py-2 bg-[var(--surface-secondary)] border border-[var(--border-light)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>
            
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <X className="h-4 w-4 mr-1" />
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner className="text-blue-600" />
        </div>
      ) : error ? (
        <div className="text-center text-red-400 py-8">{error}</div>
      ) : (
        <>
          {/* Traces Table - Horizontally scrollable on mobile */}
          <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] overflow-hidden">
            <div className="overflow-x-auto">
              {/* Table Header */}
              <div className="px-4 py-3 border-b border-[var(--border-light)] bg-[var(--surface-secondary)] min-w-[900px]">
                <div className="grid grid-cols-12 gap-4 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                  <span className="col-span-2">User</span>
                  <span className="col-span-2">Conversation</span>
                  <span className="col-span-3">Input / Output</span>
                  <span className="col-span-1 text-center">Model</span>
                  <span className="col-span-1 text-right">Tokens</span>
                  <span className="col-span-1 text-right">Cost</span>
                  <span className="col-span-1">Flags</span>
                  <span className="col-span-1 text-right">Time</span>
                </div>
              </div>

              {/* Traces */}
              <div className="divide-y divide-[var(--border-light)] min-w-[900px]">
                {filteredTraces.length === 0 ? (
                  <div className="text-center text-[var(--text-tertiary)] py-12">
                    No traces found
                  </div>
                ) : (
                  filteredTraces.map((trace) => (
                    <div
                      key={trace.id}
                      className="px-4 py-3 grid grid-cols-12 gap-4 items-center hover:bg-[var(--surface-secondary)] cursor-pointer transition-colors"
                      onClick={() => openDrawer(trace)}
                    >
                    {/* User */}
                    <div className="col-span-2 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 flex-shrink-0">
                          <User className="h-4 w-4 text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                            {trace.user?.name || 'Unknown'}
                          </p>
                          <p className="text-xs text-[var(--text-tertiary)] truncate">
                            {trace.user?.email || '—'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Conversation */}
                    <div className="col-span-2 min-w-0">
                      <p className="text-sm text-[var(--text-primary)] truncate" title={trace.conversationTitle}>
                        {trace.conversationTitle}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)] font-mono truncate" title={trace.conversationId}>
                        {trace.conversationId?.substring(0, 12)}...
                      </p>
                    </div>

                    {/* Input/Output Preview */}
                    <div className="col-span-3 min-w-0">
                      <div className="space-y-1">
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-blue-400 font-medium mt-0.5 flex-shrink-0">IN:</span>
                          <p className="text-xs text-[var(--text-secondary)] truncate">
                            {truncateText(trace.input?.text, 50) || <span className="italic text-[var(--text-tertiary)]">Empty</span>}
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-green-400 font-medium mt-0.5 flex-shrink-0">OUT:</span>
                          <p className="text-xs text-[var(--text-secondary)] truncate">
                            {truncateText(trace.output?.text, 50) || <span className="italic text-[var(--text-tertiary)]">Empty</span>}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Model */}
                    <div className="col-span-1 text-center">
                      <span className="inline-flex px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs font-medium truncate max-w-full" title={trace.trace.modelName}>
                        {trace.trace.modelName?.split(' ').pop() || trace.trace.model?.split(':')[0]}
                      </span>
                    </div>

                    {/* Tokens */}
                    <div className="col-span-1 text-right">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {(trace.trace?.totalTokens || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        <span className="text-blue-400">{(trace.trace?.inputTokens || 0).toLocaleString()}</span>
                        {' / '}
                        <span className="text-green-400">{(trace.trace?.outputTokens || 0).toLocaleString()}</span>
                      </p>
                    </div>

                    {/* Cost */}
                    <div className="col-span-1 text-right">
                      <p className="text-sm font-semibold text-green-400">
                        ${(trace.trace?.totalCost || 0).toFixed(4)}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        ${(trace.trace?.inputCost || 0).toFixed(4)} / ${(trace.trace?.outputCost || 0).toFixed(4)}
                      </p>
                    </div>

                    {/* Flags */}
                    <div className="col-span-1">
                      <div className="flex flex-wrap gap-1">
                        {trace.trace?.thinking && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs" title="Extended Thinking">
                            <Brain className="h-3 w-3" />
                          </span>
                        )}
                        {trace.trace?.toolCalls && trace.trace.toolCalls.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs" title={`${trace.trace.toolCalls.length} Tool Calls`}>
                            <Wrench className="h-3 w-3" />
                            <span>{trace.trace.toolCalls.length}</span>
                          </span>
                        )}
                        {!trace.trace?.thinking && (!trace.trace?.toolCalls || trace.trace.toolCalls.length === 0) && (
                          <span className="text-xs text-[var(--text-tertiary)]">—</span>
                        )}
                      </div>
                    </div>

                      {/* Time */}
                      <div className="col-span-1 text-right">
                        <p className="text-sm text-[var(--text-primary)]">{formatTime(trace.createdAt)}</p>
                        <p className="text-xs text-[var(--text-tertiary)]">{formatDate(trace.createdAt)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Pagination */}
          {data && data.pagination && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--text-secondary)]">
                Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} total traces)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={!data.pagination.hasPrev}
                  onClick={() => setPage(p => p - 1)}
                  className="border-[var(--border-light)]"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={!data.pagination.hasNext}
                  onClick={() => setPage(p => p + 1)}
                  className="border-[var(--border-light)]"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Trace Drawer */}
      <TraceDrawer trace={selectedTrace} isOpen={drawerOpen} onClose={closeDrawer} />
    </div>
  );
}
